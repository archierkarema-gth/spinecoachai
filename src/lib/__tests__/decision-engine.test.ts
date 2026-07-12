import { describe, expect, it } from "vitest";
import {
  decideIntensity,
  generateSession,
  deriveGoalWeights,
  deriveCapability,
  pickForDomain,
  type EngineInputs,
} from "@/lib/decision-engine";
import { EXERCISE_SEED } from "@/lib/exercise-seed";
import type { Assessment } from "@/lib/schemas";
import type { CheckIn } from "@/lib/exercise-schemas";
import type { WorkoutLog } from "@/lib/log-schemas";
import { exerciseSchema } from "@/lib/exercise-schemas";

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
    expect(result.blocks.flatMap((b) => b.exercises).length).toBeGreaterThan(0);
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

describe("pickForDomain", () => {
  it("excludes any exercise that needs equipment", () => {
    const geared = {
      ...EXERCISE_SEED[0],
      id: "geared",
      domain: "core" as const,
      equipment: ["band"],
      difficulty: "beginner" as const,
    };
    const picks = pickForDomain([geared, ...EXERCISE_SEED], "core", 1, 3, 5);
    expect(picks.some((e) => e.id === "geared")).toBe(false);
  });

  it("returns a balanced left/right pair when both exist", () => {
    const picks = pickForDomain(EXERCISE_SEED, "stability", 1, 3, 2);
    const sides = picks.map((e) => e.sideEmphasis).sort();
    expect(sides).toEqual(["left", "right"]);
  });

  it("keeps picks within the difficulty window", () => {
    const picks = pickForDomain(EXERCISE_SEED, "core", 2, 3, 5);
    expect(picks.every((e) => e.difficulty !== "beginner")).toBe(true);
  });

  it("prefers the hardest in-window move when preferHardest is set", () => {
    const easiestFirst = pickForDomain(EXERCISE_SEED, "strength", 1, 3, 1);
    const hardestFirst = pickForDomain(EXERCISE_SEED, "strength", 1, 3, 1, {
      preferHardest: true,
    });
    const rank = { beginner: 1, intermediate: 2, advanced: 3 } as const;
    expect(rank[hardestFirst[0].difficulty]).toBeGreaterThanOrEqual(
      rank[easiestFirst[0].difficulty]
    );
    expect(hardestFirst[0].difficulty).toBe("advanced");
  });
});

describe("generateSession — advanced surfacing", () => {
  it("leads the strength block with the hardest move for a capable, full-readiness user", () => {
    const result = generateSession(
      inputs({
        assessment: { ...baseAssessment, activityLevel: "active" },
        checkIn: checkIn({ painLevel: 1, recovery: 5, energyLevel: 5, sleepQuality: 5 }),
      })
    );
    const strength = result.blocks.find((b) => b.domain === "strength");
    expect(strength).toBeDefined();
    // Hardest-first: the first picked strength move must be advanced. Easiest-first
    // (the pre-fix behavior) would lead with a beginner move, failing this.
    expect(strength!.exercises[0].difficulty).toBe("advanced");
  });

  it("keeps a genuine beginner on easiest moves even at full readiness", () => {
    const result = generateSession(
      inputs({
        assessment: { ...baseAssessment, activityLevel: "sedentary" },
        checkIn: checkIn({ painLevel: 1, recovery: 5, energyLevel: 5, sleepQuality: 5 }),
      })
    );
    const all = result.blocks.flatMap((b) => b.exercises);
    expect(all.every((e) => e.difficulty !== "advanced")).toBe(true);
  });
});

describe("generateSession — personalization", () => {
  it("an active, ready user gets non-beginner strength work", () => {
    const result = generateSession(
      inputs({
        assessment: {
          ...baseAssessment,
          activityLevel: "active",
          primaryGoals: "Tambah kekuatan otot dan postur tegap",
        },
        checkIn: checkIn({ painLevel: 1, recovery: 5, energyLevel: 5, sleepQuality: 5 }),
      })
    );
    const strength = result.blocks.find((b) => b.domain === "strength");
    expect(strength).toBeDefined();
    expect(strength!.exercises.some((e) => e.difficulty !== "beginner")).toBe(true);
  });

  it("balanced focus produces both a stability and a strength block", () => {
    const result = generateSession(
      inputs({
        assessment: { ...baseAssessment, activityLevel: "moderate" },
        checkIn: checkIn({ availableMinutes: 60 }),
      })
    );
    expect(result.blocks.some((b) => b.domain === "stability")).toBe(true);
    expect(result.blocks.some((b) => b.domain === "strength")).toBe(true);
  });

  it("still escalates on a red flag", () => {
    const result = generateSession(
      inputs({
        assessment: {
          ...baseAssessment,
          redFlags: { ...noRedFlags, trauma: true },
        },
      })
    );
    expect(result.escalated).toBe(true);
  });
});

describe("generateSession — equipment allowlist", () => {
  const readyActive = {
    assessment: {
      ...baseAssessment,
      activityLevel: "active" as const,
      availableMinutesPerDay: 90,
    },
    checkIn: checkIn({
      painLevel: 1,
      recovery: 5,
      energyLevel: 5,
      sleepQuality: 5,
      availableMinutes: 90,
    }),
    workoutLogs: [log(), log(), log()],
  };

  it("hides pull-up moves when the user owns no equipment", () => {
    const result = generateSession(inputs(readyActive));
    const all = result.blocks.flatMap((b) => b.exercises);
    expect(all.some((e) => e.equipment.includes("pull-up bar"))).toBe(false);
  });

  it("includes pull-up moves when the user owns a bar", () => {
    const result = generateSession(
      inputs({ ...readyActive, ownedEquipment: ["pull-up bar"] })
    );
    const all = result.blocks.flatMap((b) => b.exercises);
    expect(all.some((e) => e.equipment.includes("pull-up bar"))).toBe(true);
  });
});

describe("EXERCISE_SEED integrity", () => {
  it("bodyweight moves have no equipment; geared moves list only known equipment", () => {
    const known = new Set(["pull-up bar"]);
    for (const ex of EXERCISE_SEED) {
      expect(ex.equipment.every((item) => known.has(item))).toBe(true);
    }
  });

  it("every entry validates against the schema", () => {
    for (const ex of EXERCISE_SEED) {
      expect(() => exerciseSchema.parse(ex)).not.toThrow();
    }
  });

  it("has unique ids and resolvable progression/regression links", () => {
    const ids = new Set(EXERCISE_SEED.map((e) => e.id));
    expect(ids.size).toBe(EXERCISE_SEED.length);
    for (const ex of EXERCISE_SEED) {
      if (ex.progressionId) expect(ids.has(ex.progressionId)).toBe(true);
      if (ex.regressionId) expect(ids.has(ex.regressionId)).toBe(true);
    }
  });

  it("has at least 5 strength movements after expansion", () => {
    expect(EXERCISE_SEED.filter((e) => e.domain === "strength").length).toBeGreaterThanOrEqual(5);
  });
});
