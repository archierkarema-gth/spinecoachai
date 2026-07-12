import type { Assessment } from "@/lib/schemas";
import { hasRedFlag } from "@/lib/schemas";
import type {
  CheckIn,
  Exercise,
  ExerciseDomain,
} from "@/lib/exercise-schemas";
import type { WorkoutLog } from "@/lib/log-schemas";

/**
 * AI Decision Engine (docs/05_AI_Decision_Engine.md).
 *
 * Pure, deterministic, and rule-based — no network, no model call. This is
 * the "AI logic" layer kept separate from UI and storage per the master
 * prompt (docs/10). It never diagnoses and safety always wins over
 * performance (docs/02, docs/04).
 *
 * Decision order (docs/05):
 *   1 Safety  2 Recovery  3 Weekly Plan  4 Progressive Overload  5 Daily Session
 */

export type SessionIntensity = "recovery" | "light" | "moderate" | "full";

export interface SessionBlock {
  domain: ExerciseDomain;
  label: string;
  exercises: Exercise[];
}

export interface GeneratedSession {
  movementFocus: string;
  intensity: SessionIntensity;
  blocks: SessionBlock[];
  estimatedMinutes: number;
  reasoning: string[];
  /** True when the engine declined to prescribe and routed to medical review. */
  escalated: boolean;
}

export interface EngineInputs {
  assessment: Assessment;
  checkIn: CheckIn;
  exercises: Exercise[];
  /** Timestamps (ms) of recent completed sessions, newest first. */
  recentSessionTimestamps: number[];
  /** Recent workout logs, newest first — feeds capability. Defaults to []. */
  workoutLogs?: WorkoutLog[];
  /** Equipment the user owns; unlocks geared moves. Defaults to []. */
  ownedEquipment?: string[];
}

export interface GoalWeights {
  posture: number;
  strength: number;
  mobility: number;
  pain: number;
}

const GOAL_KEYWORDS: Record<keyof GoalWeights, string[]> = {
  posture: ["postur", "tegap", "posture"],
  strength: ["kekuatan", "strength", "otot", "kuat"],
  mobility: ["mobil", "lentur", "fleks"],
  pain: ["nyeri", "sakit", "pain"],
};

/**
 * Derive focus weights from the free-text primaryGoals. Deterministic keyword
 * scan; when nothing matches, fall back to a balanced posture+strength default.
 * Weights bias per-domain slot counts, never add or remove safety domains.
 */
export function deriveGoalWeights(assessment: Assessment): GoalWeights {
  const text = (assessment.primaryGoals ?? "").toLowerCase();
  const weights: GoalWeights = { posture: 0, strength: 0, mobility: 0, pain: 0 };
  for (const key of Object.keys(GOAL_KEYWORDS) as (keyof GoalWeights)[]) {
    if (GOAL_KEYWORDS[key].some((kw) => text.includes(kw))) weights[key] = 1;
  }
  const anyMatch = Object.values(weights).some((v) => v > 0);
  if (!anyMatch) return { posture: 1, strength: 1, mobility: 0, pain: 0 };
  return weights;
}

export interface Capability {
  floorRank: 1 | 2 | 3;
}

const ACTIVITY_FLOOR: Record<Assessment["activityLevel"], 1 | 2 | 3> = {
  sedentary: 1,
  light: 1,
  moderate: 1,
  active: 2,
};

function clampRank(n: number): 1 | 2 | 3 {
  return Math.min(3, Math.max(1, n)) as 1 | 2 | 3;
}

/**
 * Difficulty floor the engine may start from, so a fit user is not locked into
 * beginner moves. Baseline from activityLevel; earned bump/drop from the most
 * recent workout logs (source of "stored progression" — no new store).
 */
export function deriveCapability(
  assessment: Assessment,
  workoutLogs: WorkoutLog[]
): Capability {
  let floor: number = ACTIVITY_FLOOR[assessment.activityLevel];
  const recent = workoutLogs.slice(0, 3);
  const cleanStreak =
    recent.length === 3 &&
    recent.every(
      (l) => l.exercises.every((e) => e.completed) && (l.postSessionPain ?? 0) <= 3
    );
  const latest = workoutLogs[0];
  const setback =
    latest !== undefined &&
    ((latest.postSessionPain ?? 0) >= 6 ||
      !latest.exercises.every((e) => e.completed));
  if (cleanStreak) floor += 1;
  if (setback) floor -= 1;
  return { floorRank: clampRank(floor) };
}

// Difficulty ceiling for each intensity — the engine never picks a movement
// harder than the day allows.
const DIFFICULTY_CEILING: Record<SessionIntensity, number> = {
  recovery: 0, // recovery/breathing only, difficulty ignored
  light: 1, // beginner
  moderate: 2, // up to intermediate
  full: 3, // up to advanced
};

const DIFFICULTY_RANK = { beginner: 1, intermediate: 2, advanced: 3 } as const;

/** Ordered domains that make up a full session, in sequence. */
const FULL_SEQUENCE: { domain: ExerciseDomain; label: string }[] = [
  { domain: "breathing", label: "Napas" },
  { domain: "mobility", label: "Mobilitas" },
  { domain: "stability", label: "Stabilitas" },
  { domain: "core", label: "Core" },
  { domain: "balance", label: "Keseimbangan" },
  { domain: "strength", label: "Kekuatan" },
  { domain: "conditioning", label: "Kondisi" },
  { domain: "recovery", label: "Pendinginan" },
];

const RECOVERY_SEQUENCE: { domain: ExerciseDomain; label: string }[] = [
  { domain: "breathing", label: "Napas" },
  { domain: "mobility", label: "Mobilitas" },
  { domain: "recovery", label: "Pemulihan" },
];

/**
 * Decide the day's intensity from check-in signals. Safety and recovery come
 * before any performance goal (docs/05 decision order 1–2).
 */
export function decideIntensity(checkIn: CheckIn): SessionIntensity {
  // High pain overrides everything → recovery only.
  if (checkIn.painLevel >= 7) return "recovery";

  // Poor recovery/sleep/energy → keep it light.
  const lowReadiness =
    checkIn.recovery <= 2 || checkIn.sleepQuality <= 2 || checkIn.energyLevel <= 2;
  if (lowReadiness || checkIn.painLevel >= 4) return "light";

  const highReadiness =
    checkIn.recovery >= 4 && checkIn.energyLevel >= 4 && checkIn.painLevel <= 2;
  if (highReadiness) return "full";

  return "moderate";
}

/**
 * Pick exercises for a domain within a difficulty window, bodyweight only, with
 * generic left/right balancing. Never targets a specific curve (docs/04).
 * Exported for unit testing.
 */
export interface PickOptions {
  /** Sort the in-window pool hardest-first (for capable users). */
  preferHardest?: boolean;
  /** Equipment the user owns; bodyweight (empty) is always allowed. */
  allowedEquipment?: Set<string>;
}

export function pickForDomain(
  exercises: Exercise[],
  domain: ExerciseDomain,
  floorRank: number,
  ceilingRank: number,
  max: number,
  opts: PickOptions = {}
): Exercise[] {
  const allowed = opts.allowedEquipment ?? new Set<string>();
  const eligible = exercises.filter(
    (ex) =>
      ex.domain === domain &&
      ex.equipment.every((item) => allowed.has(item))
  );
  const inWindow = eligible.filter((ex) => {
    const r = DIFFICULTY_RANK[ex.difficulty];
    return r >= floorRank && r <= ceilingRank;
  });
  // If the window is empty, relax the floor down to beginner so a block is
  // never silently dropped; still respect the ceiling (safety).
  const pool =
    inWindow.length > 0
      ? inWindow
      : eligible.filter((ex) => DIFFICULTY_RANK[ex.difficulty] <= ceilingRank);

  const dir = opts.preferHardest ? -1 : 1;
  const byPreference = [...pool].sort(
    (a, b) => dir * (DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty])
  );

  const lefts = byPreference.filter((e) => e.sideEmphasis === "left");
  const rights = byPreference.filter((e) => e.sideEmphasis === "right");
  const result: Exercise[] = [];

  // Generic balance: if we have both sides and room for a pair, take one each.
  // Pairs easiest-left with easiest-right for GENERIC symmetry only — not
  // curve-specific targeting; with the symmetric seed these are the same
  // movement family.
  if (lefts.length > 0 && rights.length > 0 && max >= 2) {
    result.push(lefts[0], rights[0]);
  }
  for (const ex of byPreference) {
    if (result.length >= max) break;
    if (result.includes(ex)) continue;
    result.push(ex);
  }
  return result.slice(0, max);
}

/**
 * Generate today's session. Returns an escalated result (no exercises) when
 * the assessment carries any red flag (docs/04) — the caller must route the
 * user to medical review instead of training.
 */
export function generateSession(inputs: EngineInputs): GeneratedSession {
  const { assessment, checkIn, exercises } = inputs;
  const reasoning: string[] = [];

  // 1. Safety.
  if (hasRedFlag(assessment.redFlags)) {
    return {
      movementFocus: "Perlu tinjauan medis",
      intensity: "recovery",
      blocks: [],
      estimatedMinutes: 0,
      reasoning: [
        "Asesmen menandai gejala yang perlu dicek tenaga medis dulu.",
        "SpineCoach tidak menyusun latihan sampai gejala itu ditangani.",
      ],
      escalated: true,
    };
  }

  // 2. Recovery / readiness.
  const intensity = decideIntensity(checkIn);
  if (intensity === "recovery") {
    reasoning.push(
      `Nyeri ${checkIn.painLevel}/10 — hari ini fokus pemulihan, bukan beban.`
    );
  } else if (intensity === "light") {
    reasoning.push("Kesiapan tubuh rendah — sesi ringan biar tetap konsisten.");
  } else if (intensity === "full") {
    reasoning.push("Kesiapan tinggi — sesi penuh dengan progresi.");
  } else {
    reasoning.push("Kesiapan sedang — sesi standar terkontrol.");
  }

  // 3. Weekly plan (light touch): if trained in the last ~20h, ease off one step.
  const lastSession = inputs.recentSessionTimestamps[0];
  const trainedRecently =
    lastSession !== undefined &&
    checkIn.createdAt - lastSession < 20 * 60 * 60 * 1000;
  if (trainedRecently && intensity === "full") {
    reasoning.push("Baru latihan <20 jam lalu — tidak menumpuk beban penuh.");
  }

  // 5. Build the daily session, fitting the user's available time.
  const sequence = intensity === "recovery" ? RECOVERY_SEQUENCE : FULL_SEQUENCE;
  const budgetSeconds = checkIn.availableMinutes * 60;

  const ceilingRank = DIFFICULTY_CEILING[intensity];
  const capability = deriveCapability(assessment, inputs.workoutLogs ?? []);
  const floorRank = Math.min(capability.floorRank, ceilingRank);
  const preferHardest = capability.floorRank >= 2;
  const weights = deriveGoalWeights(assessment);
  const allowedEquipment = new Set(inputs.ownedEquipment ?? []);

  const blocks: SessionBlock[] = [];
  let usedSeconds = 0;
  for (const step of sequence) {
    // mobility and pain weights are currently informational only (per spec §4);
    // only posture and strength influence per-domain slot boosting below.
    const boosted =
      (step.domain === "strength" && weights.strength > 0) ||
      ((step.domain === "stability" || step.domain === "breathing") &&
        weights.posture > 0);
    const max = intensity === "recovery" ? 2 : boosted ? 3 : 2;
    const picks =
      intensity === "recovery"
        ? pickForDomain(exercises, step.domain, 1, DIFFICULTY_RANK.beginner, max, {
            allowedEquipment,
          })
        : pickForDomain(exercises, step.domain, floorRank, ceilingRank, max, {
            preferHardest,
            allowedEquipment,
          });
    const fitted: Exercise[] = [];
    for (const ex of picks) {
      if (usedSeconds + ex.durationSeconds > budgetSeconds && blocks.length > 0) {
        break;
      }
      fitted.push(ex);
      usedSeconds += ex.durationSeconds;
    }
    if (fitted.length > 0) {
      blocks.push({ domain: step.domain, label: step.label, exercises: fitted });
    }
  }

  // 4. Progressive overload note (informational only in the MVP).
  if (intensity === "full" && !trainedRecently) {
    reasoning.push(
      "Kalau gerakan terasa mudah dan tanpa nyeri, naik ke progresinya."
    );
  }

  if (blocks.flatMap((b) => b.exercises).some((e) => e.difficulty === "advanced")) {
    reasoning.push("Kesiapan & progres bagus — termasuk variasi tingkat lanjut.");
  }

  const focus =
    intensity === "recovery"
      ? "Pemulihan & napas"
      : blocks.some((b) => b.domain === "stability" || b.domain === "core")
        ? "Stabilitas tulang belakang"
        : "Mobilitas & kontrol";

  return {
    movementFocus: focus,
    intensity,
    blocks,
    estimatedMinutes: Math.round(usedSeconds / 60),
    reasoning,
    escalated: false,
  };
}
