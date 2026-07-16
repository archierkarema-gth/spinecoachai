import { describe, expect, it } from "vitest";
import {
  assessmentSchema,
  hasRedFlag,
  newAssessmentInputSchema,
  userSchema,
  type RedFlagSymptoms,
} from "@/lib/schemas";
import { muscleGroupEnum } from "@/lib/exercise-schemas";
import {
  benchmarkLogSchema,
  newBenchmarkLogInputSchema,
} from "@/lib/log-schemas";

const noFlags: RedFlagSymptoms = {
  neurologicalSymptoms: false,
  bowelBladderChanges: false,
  severeWorseningPain: false,
  trauma: false,
  feverWithSevereBackPain: false,
};

const baseAssessment = {
  id: "a1",
  userId: "u1",
  createdAt: 1000,
  diagnosedByPhysician: false,
  painLevel: 5,
  activityLevel: "moderate" as const,
  availableMinutesPerDay: 30,
  primaryGoals: "Improve posture",
  redFlags: noFlags,
};

describe("hasRedFlag", () => {
  it("returns false when no red flag is set", () => {
    expect(hasRedFlag(noFlags)).toBe(false);
  });

  it("returns true when any single red flag is set", () => {
    expect(hasRedFlag({ ...noFlags, trauma: true })).toBe(true);
  });
});

describe("newAssessmentInputSchema", () => {
  const validInput = {
    userId: "user-1",
    diagnosedByPhysician: true,
    painLevel: 3,
    activityLevel: "light" as const,
    availableMinutesPerDay: 20,
    primaryGoals: "Kurangi nyeri punggung",
    redFlags: noFlags,
  };

  it("accepts a valid assessment payload", () => {
    const result = newAssessmentInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects pain level above 10", () => {
    const result = newAssessmentInputSchema.safeParse({
      ...validInput,
      painLevel: 11,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty primary goals", () => {
    const result = newAssessmentInputSchema.safeParse({
      ...validInput,
      primaryGoals: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("userSchema personalization fields", () => {
  it("defaults trainingPreset to balanced and ownedEquipment to empty", () => {
    const u = userSchema.parse({
      id: "u1",
      name: "Test",
      age: 30,
      createdAt: 0,
    });
    expect(u.trainingPreset).toBe("balanced");
    expect(u.ownedEquipment).toEqual([]);
  });

  it("accepts muscle-priority and an equipment list", () => {
    const u = userSchema.parse({
      id: "u1",
      name: "Test",
      age: 30,
      createdAt: 0,
      trainingPreset: "muscle-priority",
      ownedEquipment: ["pull-up bar"],
    });
    expect(u.trainingPreset).toBe("muscle-priority");
    expect(u.ownedEquipment).toEqual(["pull-up bar"]);
  });
});

describe("benchmarkLogSchema", () => {
  const validLog = {
    id: "b1",
    userId: "user-1",
    createdAt: 1000,
    type: "plank_hold" as const,
    value: 45,
  };

  it("accepts a valid plank_hold log", () => {
    expect(benchmarkLogSchema.safeParse(validLog).success).toBe(true);
  });

  it("accepts an optional note", () => {
    const result = benchmarkLogSchema.safeParse({ ...validLog, note: "Terasa lebih kuat" });
    expect(result.success).toBe(true);
  });

  it("rejects a zero value", () => {
    expect(benchmarkLogSchema.safeParse({ ...validLog, value: 0 }).success).toBe(false);
  });

  it("rejects a negative value", () => {
    expect(benchmarkLogSchema.safeParse({ ...validLog, value: -5 }).success).toBe(false);
  });

  it("rejects an unknown type", () => {
    expect(benchmarkLogSchema.safeParse({ ...validLog, type: "push_up" }).success).toBe(false);
  });
});

describe("newBenchmarkLogInputSchema", () => {
  it("accepts a payload without id and createdAt", () => {
    const input = { userId: "user-1", type: "plank_hold" as const, value: 30 };
    expect(newBenchmarkLogInputSchema.safeParse(input).success).toBe(true);
  });
});

describe("assessmentSchema muscle & breathing preferences", () => {
  it("accepts an assessment with no weakMuscles/tightMuscles/breathingPattern", () => {
    const parsed = assessmentSchema.parse(baseAssessment);
    expect(parsed.weakMuscles).toBeUndefined();
    expect(parsed.tightMuscles).toBeUndefined();
    expect(parsed.breathingPattern).toBeUndefined();
  });

  it("accepts valid muscle groups and a breathing pattern", () => {
    const parsed = assessmentSchema.parse({
      ...baseAssessment,
      weakMuscles: ["glute", "core"],
      tightMuscles: ["hip-flexor"],
      breathingPattern: "chest-dominant",
    });
    expect(parsed.weakMuscles).toEqual(["glute", "core"]);
    expect(parsed.tightMuscles).toEqual(["hip-flexor"]);
    expect(parsed.breathingPattern).toBe("chest-dominant");
  });

  it("rejects an invalid breathingPattern value", () => {
    expect(() =>
      assessmentSchema.parse({ ...baseAssessment, breathingPattern: "mouth" })
    ).toThrow();
  });
});
