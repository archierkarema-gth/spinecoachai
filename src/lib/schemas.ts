import { z } from "zod";

/**
 * Zod schemas for the SpineCoach AI data model (docs/08_Data_Model.md).
 * Only User and Assessment are fleshed out for Milestone 1 — the remaining
 * entities are declared as empty IndexedDB stores in lib/db.ts and will get
 * their own schemas in later milestones.
 */

export const activityLevelEnum = z.enum([
  "sedentary",
  "light",
  "moderate",
  "active",
]);
export type ActivityLevel = z.infer<typeof activityLevelEnum>;

// Mirrors the escalation triggers in docs/04_Clinical_Guardrails.md exactly.
// If any of these is true, the app must escalate to medical review rather
// than generate a workout.
export const redFlagSymptomsSchema = z.object({
  neurologicalSymptoms: z.boolean(),
  bowelBladderChanges: z.boolean(),
  severeWorseningPain: z.boolean(),
  trauma: z.boolean(),
  feverWithSevereBackPain: z.boolean(),
});
export type RedFlagSymptoms = z.infer<typeof redFlagSymptomsSchema>;

export function hasRedFlag(flags: RedFlagSymptoms): boolean {
  return Object.values(flags).some(Boolean);
}

export const userSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nama wajib diisi"),
  age: z.number().int().min(13).max(100),
  createdAt: z.number(),
});
export type User = z.infer<typeof userSchema>;

export const assessmentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),

  // Self-reported only. The app never diagnoses scoliosis or estimates a
  // Cobb angle — see docs/04_Clinical_Guardrails.md.
  diagnosedByPhysician: z.boolean(),
  curveLocationSelfReported: z
    .string()
    .max(200)
    .optional()
    .describe("As told by a doctor, optional — the app does not diagnose."),

  painLevel: z.number().int().min(0).max(10),
  painAreas: z.string().max(300).optional(),
  mobilityLimitations: z.string().max(500).optional(),

  activityLevel: activityLevelEnum,
  availableMinutesPerDay: z.number().int().min(5).max(180),
  primaryGoals: z.string().min(1, "Tulis minimal satu tujuan").max(500),

  redFlags: redFlagSymptomsSchema,
});
export type Assessment = z.infer<typeof assessmentSchema>;

export const newAssessmentInputSchema = assessmentSchema.omit({
  id: true,
  createdAt: true,
});
export type NewAssessmentInput = z.infer<typeof newAssessmentInputSchema>;
