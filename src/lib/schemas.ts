import { z } from "zod";
import { muscleGroupEnum, type MuscleGroup } from "@/lib/exercise-schemas";

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

export const trainingPresetEnum = z.enum(["balanced", "muscle-priority"]);
export type TrainingPreset = z.infer<typeof trainingPresetEnum>;

// Curve-targeted personalization (owner decision, 2026-07-20 — supersedes the
// earlier generic-only stance in docs/04_Clinical_Guardrails.md /
// docs/11_Roadmap_M9-M14.md for THIS single-user app; see the dated addendum
// in both docs). Still self-report only: every value here is what the owner
// typed in from their own doctor-reported record, never computed or
// diagnosed by the app (docs/04). The engine uses these only to bias which
// side/variant of an already-safe exercise is picked — it never claims a
// degree of correction.
export const curveDirectionEnum = z.enum(["left", "right"]);
export type CurveDirection = z.infer<typeof curveDirectionEnum>;

export const clinicalGradeEnum = z.enum(["mild", "moderate", "severe"]);
export type ClinicalGrade = z.infer<typeof clinicalGradeEnum>;

export const curveSegmentSchema = z.object({
  location: z.string().max(80),
  cobbDegrees: z.number().min(0).max(180),
  /** Convexity direction, as reported by the owner's radiology/physician note. */
  direction: curveDirectionEnum,
});
export type CurveSegment = z.infer<typeof curveSegmentSchema>;

export const clinicalProfileSchema = z.object({
  upperCurve: curveSegmentSchema.optional(),
  mainCurve: curveSegmentSchema.optional(),
  atrDegrees: z.number().min(0).max(90).optional(),
  ribHumpSide: z.enum(["left", "right", "none"]).optional(),
  clinicalGrade: clinicalGradeEnum.optional(),
  heightCm: z.number().positive().optional(),
  weightKg: z.number().positive().optional(),
  targetWeightKg: z.number().positive().optional(),
});
export type ClinicalProfile = z.infer<typeof clinicalProfileSchema>;

export const breathingPatternEnum = z.enum([
  "chest-dominant",
  "diaphragmatic",
  "shallow",
  "not-sure",
]);
export type BreathingPattern = z.infer<typeof breathingPatternEnum>;

export const userSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nama wajib diisi"),
  age: z.number().int().min(13).max(100),
  createdAt: z.number(),
  trainingPreset: trainingPresetEnum.default("balanced"),
  ownedEquipment: z.array(z.string()).default([]),
  // M16 (spec §2 UserFlags). Optional; undefined is treated as FALSE
  // everywhere (safe default) — exercises with requiresPTClearance stay
  // locked until a PT clears the owner and this is set true. Never auto-set.
  ptCleared: z.boolean().optional(),
});
export type User = z.infer<typeof userSchema>;

export const assessmentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),

  // Self-reported only. The app never diagnoses scoliosis or estimates a
  // Cobb angle itself — see docs/04_Clinical_Guardrails.md. clinicalProfile
  // (added 2026-07-20) is structured self-report for the SAME reason
  // curveLocationSelfReported exists: it is what the owner typed in from
  // their own doctor's record, used only to bias exercise/side selection —
  // never to compute or claim a corrected degree.
  diagnosedByPhysician: z.boolean(),
  curveLocationSelfReported: z
    .string()
    .max(400)
    .optional()
    .describe("As told by a doctor, optional — the app does not diagnose."),
  clinicalProfile: clinicalProfileSchema.optional(),

  painLevel: z.number().int().min(0).max(10),
  painAreas: z.string().max(300).optional(),
  mobilityLimitations: z.string().max(500).optional(),

  activityLevel: activityLevelEnum,
  availableMinutesPerDay: z.number().int().min(5).max(180),
  primaryGoals: z.string().min(1, "Tulis minimal satu tujuan").max(500),

  // Preferences, not clinical curve data (docs/04). Optional — no default,
  // undefined means "not yet answered", distinct from an empty array.
  weakMuscles: z.array(muscleGroupEnum).optional(),
  tightMuscles: z.array(muscleGroupEnum).optional(),
  breathingPattern: breathingPatternEnum.optional(),

  redFlags: redFlagSymptomsSchema,
});
export type Assessment = z.infer<typeof assessmentSchema>;

export const newAssessmentInputSchema = assessmentSchema.omit({
  id: true,
  createdAt: true,
});
export type NewAssessmentInput = z.infer<typeof newAssessmentInputSchema>;
