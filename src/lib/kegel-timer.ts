import type { KegelMode } from "@/lib/log-schemas";

/**
 * M16 Kegel timer (spec §8). Pure schedule builder — no DOM, no timer. Two
 * modes: `quick` (rhythmic contract/relax) and `elevator` (graded ascending
 * holds then release). A component walks the returned steps with a countdown.
 *
 * Low-load, breathing-coordinated. NOT for an already-overactive pelvic floor
 * (see the contraindications on ex-kegel-dasar).
 */

export type KegelStepKind = "contract" | "relax" | "hold";

export interface KegelStep {
  kind: KegelStepKind;
  seconds: number;
  label: string;
}

const QUICK_CONTRACT = 3;
const QUICK_RELAX = 3;
/** Elevator hold ladder in seconds — ascend then a long release. */
const ELEVATOR_LADDER = [2, 4, 6, 8];
const ELEVATOR_RELEASE = 10;

/**
 * Build the ordered step list for one Kegel set. `reps` is the number of
 * contract/relax pairs (quick) or ascents (elevator). Defaults to 10 quick /
 * 5 elevator — matching a typical daily set.
 */
export function kegelSchedule(mode: KegelMode, reps?: number): KegelStep[] {
  if (mode === "quick") {
    const n = reps ?? 10;
    const steps: KegelStep[] = [];
    for (let i = 1; i <= n; i++) {
      steps.push({ kind: "contract", seconds: QUICK_CONTRACT, label: `Kencangkan (${i}/${n})` });
      steps.push({ kind: "relax", seconds: QUICK_RELAX, label: "Rileks penuh" });
    }
    return steps;
  }
  // elevator
  const n = reps ?? 5;
  const steps: KegelStep[] = [];
  for (let i = 1; i <= n; i++) {
    for (const [floor, sec] of ELEVATOR_LADDER.entries()) {
      steps.push({
        kind: "hold",
        seconds: sec,
        label: `Naik lantai ${floor + 1} — tahan bertahap`,
      });
    }
    steps.push({ kind: "relax", seconds: ELEVATOR_RELEASE, label: "Turun perlahan, rileks penuh" });
  }
  return steps;
}

/** Total seconds for a schedule. */
export function scheduleSeconds(steps: KegelStep[]): number {
  return steps.reduce((s, step) => s + step.seconds, 0);
}
