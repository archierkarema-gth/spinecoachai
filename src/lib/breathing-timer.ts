/**
 * M16 Schroth breathing counter (spec §8, §9.1). Pure phase machine — no DOM,
 * no timer. A component ticks elapsed seconds and reads the current phase.
 *
 * Direction of breath is NOT decided here — that lives on the Schroth exercise
 * records (schrothCue / schrothCuePendingPT). This only paces inhale/hold/exhale.
 */

export type BreathPhase = "inhale" | "hold" | "exhale" | "rest";

export interface BreathingPattern {
  inhale: number;
  hold: number;
  exhale: number;
  rest: number; // hold-empty after exhale
}

/** Schroth-friendly default: slow, exhale longer than inhale. */
export const DEFAULT_PATTERN: BreathingPattern = {
  inhale: 4,
  hold: 2,
  exhale: 6,
  rest: 0,
};

const ORDER: BreathPhase[] = ["inhale", "hold", "exhale", "rest"];

export function cycleLength(p: BreathingPattern): number {
  return p.inhale + p.hold + p.exhale + p.rest;
}

export interface BreathState {
  phase: BreathPhase;
  /** Whole seconds remaining in the current phase (>=1 while active). */
  secondsLeft: number;
  /** 0-based completed-cycle index the elapsed time falls into. */
  cycle: number;
}

/**
 * Resolve the breathing phase at `elapsedSec` into a session. Phases with a
 * 0-second duration (e.g. default `rest`) are skipped. Deterministic.
 */
export function phaseAt(
  pattern: BreathingPattern,
  elapsedSec: number,
): BreathState {
  const len = cycleLength(pattern);
  if (len <= 0) return { phase: "inhale", secondsLeft: 0, cycle: 0 };
  const e = Math.max(0, Math.floor(elapsedSec));
  const cycle = Math.floor(e / len);
  let into = e % len;
  for (const phase of ORDER) {
    const dur = pattern[phase];
    if (dur <= 0) continue;
    if (into < dur) {
      return { phase, secondsLeft: dur - into, cycle };
    }
    into -= dur;
  }
  // Exactly at cycle boundary — start of next inhale.
  return { phase: "inhale", secondsLeft: pattern.inhale, cycle: cycle + 1 };
}

/** Completed breath cycles after `elapsedSec`. */
export function completedCycles(
  pattern: BreathingPattern,
  elapsedSec: number,
): number {
  const len = cycleLength(pattern);
  if (len <= 0) return 0;
  return Math.floor(Math.max(0, elapsedSec) / len);
}
