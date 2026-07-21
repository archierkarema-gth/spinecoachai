import { describe, expect, it } from "vitest";
import { userSchema, assessmentSchema } from "@/lib/schemas";
import { SEED_USER, SEED_ASSESSMENT } from "@/lib/personal-seed";
import { EXERCISE_SEED } from "@/lib/exercise-seed";

describe("personal-seed", () => {
  it("SEED_USER validates against userSchema", () => {
    const result = userSchema.safeParse({ ...SEED_USER, createdAt: Date.now() });
    expect(result.success).toBe(true);
  });

  it("SEED_ASSESSMENT validates against assessmentSchema", () => {
    const result = assessmentSchema.safeParse({
      ...SEED_ASSESSMENT,
      id: "seed-assessment",
      userId: SEED_USER.id,
      createdAt: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it("curveLocationSelfReported stays free-text — never a structured curve field", () => {
    // Guardrail regression check (docs/04, docs/11): the assessment schema
    // must not gain thoracicCurve/lumbarCurve/curveDirection fields.
    expect(typeof SEED_ASSESSMENT.curveLocationSelfReported).toBe("string");
    expect(SEED_ASSESSMENT).not.toHaveProperty("thoracicCurve");
    expect(SEED_ASSESSMENT).not.toHaveProperty("lumbarCurve");
    expect(SEED_ASSESSMENT).not.toHaveProperty("curveDirection");
  });

  it("every ownedEquipment string matches an equipment tag actually used in the exercise library", () => {
    const usedEquipment = new Set(EXERCISE_SEED.flatMap((ex) => ex.equipment));
    for (const item of SEED_USER.ownedEquipment) {
      expect(usedEquipment.has(item)).toBe(true);
    }
  });
});
