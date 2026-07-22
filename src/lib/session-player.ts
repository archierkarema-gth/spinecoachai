import type { Exercise } from "@/lib/exercise-schemas";
import type { CompletedExercise } from "@/lib/log-schemas";

/**
 * A block of exercises to play, decoupled from any engine. Both the M16 fixed
 * split (split.ts → ResolvedBlock) and any legacy source can feed this shape.
 */
export interface PlayerBlock {
  label: string;
  exercises: Exercise[];
}

/** Fixed rest inserted between consecutive exercise phases (docs spec). */
export const REST_SECONDS = 20;

export type Step =
  | {
      kind: "exercise";
      exercise: Exercise;
      side?: "left" | "right";
      seconds: number;
      phaseId: string;
    }
  | { kind: "rest"; seconds: number };

export type PhaseStatus = "done" | "skipped";

/**
 * Flatten a generated session into an ordered list of timed steps. Bilateral
 * exercises are auto-split into a left then a right phase; single-sided
 * exercises stay one phase. A 20s rest is placed between consecutive exercise
 * phases only — never before the first or after the last.
 */
export function buildSteps(blocks: PlayerBlock[]): Step[] {
  const exerciseSteps: Step[] = [];
  for (const block of blocks) {
    for (const exercise of block.exercises) {
      if (exercise.sideEmphasis === "bilateral") {
        exerciseSteps.push({
          kind: "exercise",
          exercise,
          side: "left",
          seconds: exercise.durationSeconds,
          phaseId: `${exercise.id}:left`,
        });
        exerciseSteps.push({
          kind: "exercise",
          exercise,
          side: "right",
          seconds: exercise.durationSeconds,
          phaseId: `${exercise.id}:right`,
        });
      } else {
        exerciseSteps.push({
          kind: "exercise",
          exercise,
          seconds: exercise.durationSeconds,
          phaseId: exercise.id,
        });
      }
    }
  }

  const steps: Step[] = [];
  exerciseSteps.forEach((step, i) => {
    if (i > 0) steps.push({ kind: "rest", seconds: REST_SECONDS });
    steps.push(step);
  });
  return steps;
}

/**
 * Aggregate per-phase statuses into one CompletedExercise per distinct
 * exercise, order preserved. An exercise counts as completed if at least one
 * of its phases was advanced ("done"); an absent phase counts as not done.
 */
export function toCompletedExercises(
  blocks: PlayerBlock[],
  statuses: Record<string, PhaseStatus>
): CompletedExercise[] {
  const seen = new Set<string>();
  const result: CompletedExercise[] = [];
  for (const block of blocks) {
    for (const ex of block.exercises) {
      if (seen.has(ex.id)) continue;
      seen.add(ex.id);
      const phaseIds =
        ex.sideEmphasis === "bilateral"
          ? [`${ex.id}:left`, `${ex.id}:right`]
          : [ex.id];
      const completed = phaseIds.some((p) => statuses[p] === "done");
      result.push({
        exerciseId: ex.id,
        name: ex.name,
        domain: ex.domain,
        completed,
      });
    }
  }
  return result;
}
