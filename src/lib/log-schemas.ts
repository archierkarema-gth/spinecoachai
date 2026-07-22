import { z } from "zod";
import { exerciseDomainEnum } from "@/lib/exercise-schemas";

/**
 * WorkoutLog and PainLog schemas (docs/08_Data_Model.md).
 * A WorkoutLog is written when the user finishes (or ends) a generated
 * session; its timestamp feeds back into the AI Decision Engine's weekly-plan
 * step (docs/05).
 */

export const completedExerciseSchema = z.object({
  exerciseId: z.string(),
  name: z.string(),
  domain: exerciseDomainEnum,
  completed: z.boolean(),
});
export type CompletedExercise = z.infer<typeof completedExerciseSchema>;

export const workoutLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  movementFocus: z.string(),
  intensity: z.string(),
  estimatedMinutes: z.number().int().nonnegative(),
  exercises: z.array(completedExerciseSchema),
  // 0..10 pain reported right after the session, optional.
  postSessionPain: z.number().int().min(0).max(10).optional(),
});
export type WorkoutLog = z.infer<typeof workoutLogSchema>;

export const painLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  painLevel: z.number().int().min(0).max(10),
  areas: z.string().max(300).optional(),
  note: z.string().max(500).optional(),
});
export type PainLog = z.infer<typeof painLogSchema>;

export const newPainLogInputSchema = painLogSchema.omit({
  id: true,
  createdAt: true,
});
export type NewPainLogInput = z.infer<typeof newPainLogInputSchema>;

export const benchmarkTypeEnum = z.enum(["plank_hold"]);
export type BenchmarkType = z.infer<typeof benchmarkTypeEnum>;

export const benchmarkLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  type: benchmarkTypeEnum,
  value: z.number().positive(),
  note: z.string().max(300).optional(),
});
export type BenchmarkLog = z.infer<typeof benchmarkLogSchema>;

export const newBenchmarkLogInputSchema = benchmarkLogSchema.omit({
  id: true,
  createdAt: true,
});
export type NewBenchmarkLogInput = z.infer<typeof newBenchmarkLogInputSchema>;

export const reassessmentLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  flexibility: z.number().int().min(1).max(5),
  balance: z.number().int().min(1).max(5),
  breathingQuality: z.number().int().min(1).max(5),
  painAreas: z.string().max(300).optional(),
});
export type ReassessmentLog = z.infer<typeof reassessmentLogSchema>;

export const newReassessmentLogInputSchema = reassessmentLogSchema.omit({
  id: true,
  createdAt: true,
});
export type NewReassessmentLogInput = z.infer<
  typeof newReassessmentLogInputSchema
>;

/**
 * M16 SessionLog (spec §6.2). The per-exercise record the auto-promotion
 * engine reads — there is NO manual promotion. `formRating` and
 * `mirrorCheckPass` are self-report the app cannot verify (spec §6.5 caveat).
 */
export const sessionLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  /** Local calendar date (YYYY-MM-DD) — one per exercise per day. */
  date: z.string(),
  exerciseId: z.string(),
  /** Rep-based moves. Null for pure isometrics. */
  repsDone: z.number().int().nonnegative().nullable(),
  /** Isometric moves. Null for rep-based. */
  holdSecondsDone: z.number().int().nonnegative().nullable(),
  formRating: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  /** Required (non-null) only when the exercise sets mirrorCheckRequired. */
  mirrorCheckPass: z.boolean().nullable(),
  /** 1–10 perceived effort — detects promoting while still grinding (§6.3). */
  rpe: z
    .number()
    .int()
    .min(1)
    .max(10),
});
export type SessionLog = z.infer<typeof sessionLogSchema>;

export const newSessionLogInputSchema = sessionLogSchema.omit({
  id: true,
  createdAt: true,
});
export type NewSessionLogInput = z.infer<typeof newSessionLogInputSchema>;

/**
 * M16 AsymmetryLog (spec §3, §6.6). The demoted pain toggle: a non-gate,
 * end-of-session 1-tap safety log ("sharp / one-sided pain today?"). It does
 * NOT stop a session; it feeds the symmetry check in the promotion engine and
 * the asymmetry alert. Never phrased as "curve worsening" (§6.6).
 */
export const asymmetrySideEnum = z.enum(["left", "right", "both", "central"]);
export type AsymmetrySide = z.infer<typeof asymmetrySideEnum>;

export const asymmetryTypeEnum = z.enum([
  "sharp-pain",
  "tightness",
  "compensation",
]);
export type AsymmetryType = z.infer<typeof asymmetryTypeEnum>;

export const asymmetryLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  date: z.string(),
  side: asymmetrySideEnum,
  type: asymmetryTypeEnum,
  note: z.string().max(300).optional(),
  /** Owner clears it after reviewing (feeds the dashboard safety strip). */
  reviewed: z.boolean().default(false),
});
export type AsymmetryLog = z.infer<typeof asymmetryLogSchema>;

export const newAsymmetryLogInputSchema = asymmetryLogSchema.omit({
  id: true,
  createdAt: true,
  reviewed: true,
});
export type NewAsymmetryLogInput = z.infer<typeof newAsymmetryLogInputSchema>;

/**
 * M16 Rib-Hump tracker (spec §9.2). Forward-bend (Adam's test) angle in degrees.
 * LOG ONLY — never auto-alerts "worsening" (scoliometer self-measure is noisy
 * ±few degrees). UI shows trend + "cek PT", never a clinical claim.
 */
export const ribHumpLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  date: z.string(),
  forwardBendDegrees: z.number().min(0).max(60),
  note: z.string().max(300).optional(),
});
export type RibHumpLog = z.infer<typeof ribHumpLogSchema>;

export const newRibHumpLogInputSchema = ribHumpLogSchema.omit({
  id: true,
  createdAt: true,
});
export type NewRibHumpLogInput = z.infer<typeof newRibHumpLogInputSchema>;

/**
 * M16 Kegel timer log (spec §7, §8). One row per completed Kegel session,
 * feeding the dashboard's daily Kegel count.
 */
export const kegelModeEnum = z.enum(["quick", "elevator"]);
export type KegelMode = z.infer<typeof kegelModeEnum>;

export const kegelLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  date: z.string(),
  mode: kegelModeEnum,
  reps: z.number().int().positive(),
});
export type KegelLog = z.infer<typeof kegelLogSchema>;

export const newKegelLogInputSchema = kegelLogSchema.omit({
  id: true,
  createdAt: true,
});
export type NewKegelLogInput = z.infer<typeof newKegelLogInputSchema>;
