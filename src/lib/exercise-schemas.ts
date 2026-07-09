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

// Which side(s) the movement emphasises. Scoliosis training cares about
// left/right balance, so this is first-class metadata rather than a note.
export const sideEmphasisEnum = z.enum(["bilateral", "left", "right"]);
export type SideEmphasis = z.infer<typeof sideEmphasisEnum>;

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
  videoUrl: z.string().nullable(),
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
