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
