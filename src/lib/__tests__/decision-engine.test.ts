import { describe, expect, it } from "vitest";
import {
  decideIntensity,
  generateSession,
  deriveGoalWeights,
  deriveCapability,
  type EngineInputs,
} from "@/lib/decision-engine";
import { EXERCISE_SEED } from "@/lib/exercise-seed";
import type { Assessment } from "@/lib/schemas";
import type { CheckIn } from "@/lib/exercise-schemas";
import type { WorkoutLog } from "@/lib/log-schemas";

const noRedFlags = {
  neurologicalSymptoms: false,
  bowelBladderChanges: false,
  severeWorseningPain: false,
  trauma: false,
  feverWithSevereBackPain: false,
};

const baseAssessment: Assessment = {
  id: "a1",
  userId: "u1",
  createdAt: 0,
  diagnosedByPhysician: true,
  painLevel: 3,
  activityLevel: "light",
  availableMinutesPerDay: 30,
  primaryGoals: "Kurangi nyeri",
  redFlags: noRedFlags,
};

function checkIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    id: "c1",
    userId: "u1",
    createdAt: 1_000_000,
    painLevel: 2,
    sleepQuality: 4,
    energyLevel: 4,
    recovery: 4,
    availableMinutes: 30,
    ...overrides,
  };
}

function inputs(overrides: Partial<EngineInputs> = {}): EngineInputs {
  return {
    assessment: baseAssessment,
    checkIn: checkIn(),
    exercises: EXERCISE_SEED,
    recentSessionTimestamps: [],
    ...overrides,
  };
}

describe("decideIntensity", () => {
  it("returns recovery when pain is high", () => {
    expect(decideIntensity(checkIn({ painLevel: 8 }))).toBe("recovery");
  });

  it("returns light when readiness is low", () => {
    expect(decideIntensity(checkIn({ recovery: 1 }))).toBe("light");
  });

  it("returns full when readiness is high and pain low", () => {
    expect(
      decideIntensity(
        checkIn({ painLevel: 1, recovery: 5, energyLevel: 5, sleepQuality: 5 })
      )
    ).toBe("full");
  });

  it("returns moderate in the middle", () => {
    expect(
      decideIntensity(checkIn({ painLevel: 3, recovery: 3, energyLevel: 3 }))
    ).toBe("moderate");
  });
});

describe("generateSession — safety", () => {
  it("escalates and prescribes nothing when a red flag is set", () => {
    const result = generateSession(
      inputs({
        assessment: {
          ...baseAssessment,
          redFlags: { ...noRedFlags, neurologicalSymptoms: true },
        },
      })
    );
    expect(result.escalated).toBe(true);
    expect(result.blocks).toHaveLength(0);
  });

  it("high pain yields a recovery session with no strength block", () => {
    const result = generateSession(inputs({ checkIn: checkIn({ painLevel: 9 }) }));
    expect(result.escalated).toBe(false);
    expect(result.intensity).toBe("recovery");
    expect(result.blocks.some((b) => b.domain === "strength")).toBe(false);
  });
});

describe("generateSession — building", () => {
  it("only picks beginner moves on a light day", () => {
    const result = generateSession(inputs({ checkIn: checkIn({ recovery: 1 }) }));
    const all = result.blocks.flatMap((b) => b.exercises);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((ex) => ex.difficulty === "beginner")).toBe(true);
  });

  it("respects the available-time budget", () => {
    const result = generateSession(
      inputs({ checkIn: checkIn({ availableMinutes: 10 }) })
    );
    expect(result.estimatedMinutes).toBeLessThanOrEqual(11);
    expect(result.blocks.length).toBeGreaterThan(0);
  });

  it("produces reasoning for every non-escalated session", () => {
    const result = generateSession(inputs());
    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});

describe("deriveGoalWeights", () => {
  it("weights posture and strength when both keywords appear", () => {
    const w = deriveGoalWeights({
      ...baseAssessment,
      primaryGoals: "Postur tegap dan tambah kekuatan otot",
    });
    expect(w.posture).toBeGreaterThan(0);
    expect(w.strength).toBeGreaterThan(0);
  });

  it("falls back to a balanced posture+strength default when nothing matches", () => {
    const w = deriveGoalWeights({ ...baseAssessment, primaryGoals: "xyz" });
    expect(w.posture).toBe(w.strength);
    expect(w.posture).toBeGreaterThan(0);
  });

  it("detects pain and mobility keywords", () => {
    const w = deriveGoalWeights({
      ...baseAssessment,
      primaryGoals: "Kurangi nyeri dan tingkatkan mobilitas",
    });
    expect(w.pain).toBeGreaterThan(0);
    expect(w.mobility).toBeGreaterThan(0);
  });
});

function log(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: "w1",
    userId: "u1",
    createdAt: 1_000,
    movementFocus: "x",
    intensity: "moderate",
    estimatedMinutes: 20,
    exercises: [
      { exerciseId: "e1", name: "e1", domain: "core", completed: true },
    ],
    postSessionPain: 1,
    ...overrides,
  };
}

describe("deriveCapability", () => {
  it("starts an active user at intermediate", () => {
    const cap = deriveCapability({ ...baseAssessment, activityLevel: "active" }, []);
    expect(cap.floorRank).toBe(2);
  });

  it("starts a sedentary user at beginner", () => {
    const cap = deriveCapability({ ...baseAssessment, activityLevel: "sedentary" }, []);
    expect(cap.floorRank).toBe(1);
  });

  it("bumps up after 3 clean, low-pain completions", () => {
    const cap = deriveCapability(
      { ...baseAssessment, activityLevel: "light" },
      [log(), log(), log()]
    );
    expect(cap.floorRank).toBe(2);
  });

  it("drops after a high-pain session", () => {
    const cap = deriveCapability(
      { ...baseAssessment, activityLevel: "active" },
      [log({ postSessionPain: 7 })]
    );
    expect(cap.floorRank).toBe(1);
  });

  it("never exceeds advanced", () => {
    const cap = deriveCapability(
      { ...baseAssessment, activityLevel: "active" },
      [log(), log(), log()]
    );
    expect(cap.floorRank).toBeLessThanOrEqual(3);
  });
});
