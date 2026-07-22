import { z } from "zod";

/**
 * Exercise System schemas (docs/06_Exercise_System.md).
 * Every exercise carries the metadata required by that doc: difficulty,
 * duration, equipment, contraindications, progression, regression, video.
 */

// docs/06: exercise domains, listed in the order the AI Decision Engine
// sequences a session (breathing → mobility → ... → recovery).
export const exerciseDomainEnum = z.enum([
  "breathing",
  "pelvic-floor",
  "mobility",
  "stability",
  "core",
  "balance",
  "strength",
  "conditioning",
  "recovery",
]);
export type ExerciseDomain = z.infer<typeof exerciseDomainEnum>;

export const difficultyEnum = z.enum(["beginner", "intermediate", "advanced"]);
export type Difficulty = z.infer<typeof difficultyEnum>;

/**
 * M16 redesign (spec §2). Training category for the fixed Mon–Sat split.
 * Superset of the old `domain`; a normalizer derives it from `domain` for
 * pre-M16 seed rows (see `normalizeExercise` in exercise-seed.ts).
 */
export const exerciseCategoryEnum = z.enum([
  "push",
  "pull",
  "legs",
  "core",
  "schroth",
  "mobility",
  "kegel",
  "scapular",
  "prep",
]);
export type ExerciseCategory = z.infer<typeof exerciseCategoryEnum>;

/** M16 (spec §6.1): 1 Beginner · 2 Intermediate · 3 Advanced · 4 Master. */
export const exerciseLevelEnum = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);
export type ExerciseLevel = z.infer<typeof exerciseLevelEnum>;

// Which side(s) the movement emphasises. Scoliosis training cares about
// left/right balance, so this is first-class metadata rather than a note.
export const sideEmphasisEnum = z.enum(["bilateral", "left", "right"]);
export type SideEmphasis = z.infer<typeof sideEmphasisEnum>;

// Generic muscle groups a movement primarily targets. Used to bias exercise
// *ordering* within a domain toward a user's weak/tight muscles — never a
// spine curve or biomechanical segment (docs/04_Clinical_Guardrails.md).
export const muscleGroupEnum = z.enum([
  "hip-flexor",
  "hamstring",
  "glute",
  "quad",
  "calf",
  "adductor",
  "core",
  "pelvic-floor",
  "lower-back",
  "upper-back",
  "lat",
  "trap",
  "shoulder",
  "rotator-cuff",
  "chest",
  "neck",
]);
export type MuscleGroup = z.infer<typeof muscleGroupEnum>;

export const exerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: exerciseDomainEnum,
  difficulty: difficultyEnum,
  // Seconds per set/hold — used by the engine to fit a session into the
  // user's available minutes.
  durationSeconds: z.number().int().positive(),
  equipment: z.array(z.string()), // empty array = bodyweight only
  sideEmphasis: sideEmphasisEnum,
  // Free-text cues shown during the session.
  cues: z.array(z.string()),
  // Plain-language conditions under which the user should skip the move.
  contraindications: z.array(z.string()),
  progressionId: z.string().nullable(),
  regressionId: z.string().nullable(),
  // 1-3 primary muscle groups this movement targets. Defaults to [] so
  // pre-M14 seed data (not yet retagged) still validates.
  muscles: z.array(muscleGroupEnum).default([]),
  videoUrl: z.string().nullable(),

  // ----- M16 redesign (spec §2). All optional/defaulted so pre-M16 seed rows
  // validate unchanged; `normalizeExercise` (exercise-seed.ts) fills the
  // derivable ones (category/level/family/prev-next) from the legacy fields.

  /** Fixed-split category. Undefined on pre-M16 rows → derived from `domain`. */
  category: exerciseCategoryEnum.optional(),
  /** 1–4. Undefined → derived from `difficulty` (advanced=3; 4 is seed-only). */
  level: exerciseLevelEnum.optional(),
  /** Progression-family id (Appendix A chain). Undefined → derived from id. */
  family: z.string().optional(),
  /** True → subject to the L3/6-month target (spec §6B.2); false = skill-line.
   * Optional so pre-M16 literals validate; `normalizeExercise` always sets it. */
  isFoundational: z.boolean().optional(),
  /** Explicit chain links (spec §2). Undefined → mirror progression/regressionId. */
  progressionPrevId: z.string().nullable().optional(),
  progressionNextId: z.string().nullable().optional(),
  /** Rep window; hitting max with clean form unlocks next (spec §6.3). */
  repTargetMin: z.number().int().positive().nullable().optional(),
  repTargetMax: z.number().int().positive().nullable().optional(),
  /** Isometric hold target (hollow, plank, hang, L-sit). */
  holdSeconds: z.number().int().positive().nullable().optional(),

  // ----- Schroth (spec §1). Breathing cue may be authored; strengthen/stretch/
  // rotation side must NOT be — it stays PENDING_PT until a PT validates.
  schrothCue: z.string().optional(),
  schrothCuePendingPT: z.boolean().optional(),
  mirrorCheckRequired: z.boolean().optional(),

  // ----- Safety gating (spec §2, §4).
  /** Locked behind the global `user.ptCleared` flag until true. */
  requiresPTClearance: z.boolean().optional(),
  /** Never surfaced by auto-progression; shown as "not recommended". */
  contraindicated: z.boolean().optional(),
  contraindicationReason: z.string().optional(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

// Daily Check-in inputs (docs/05_AI_Decision_Engine.md: Pain, Sleep, Energy,
// Recovery, Available time). Workout history is read from stored logs, not
// asked here.
export const checkInSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  painLevel: z.number().int().min(0).max(10),
  sleepQuality: z.number().int().min(1).max(5),
  energyLevel: z.number().int().min(1).max(5),
  recovery: z.number().int().min(1).max(5),
  availableMinutes: z.number().int().min(5).max(180),
});
export type CheckIn = z.infer<typeof checkInSchema>;

export const newCheckInInputSchema = checkInSchema.omit({
  id: true,
  createdAt: true,
});
export type NewCheckInInput = z.infer<typeof newCheckInInputSchema>;
