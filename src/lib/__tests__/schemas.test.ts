import { describe, expect, it } from "vitest";
import {
  hasRedFlag,
  newAssessmentInputSchema,
  userSchema,
  type RedFlagSymptoms,
} from "@/lib/schemas";

const noFlags: RedFlagSymptoms = {
  neurologicalSymptoms: false,
  bowelBladderChanges: false,
  severeWorseningPain: false,
  trauma: false,
  feverWithSevereBackPain: false,
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
