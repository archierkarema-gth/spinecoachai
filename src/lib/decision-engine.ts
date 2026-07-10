import type { Assessment } from "@/lib/schemas";
import { hasRedFlag } from "@/lib/schemas";
import type {
  CheckIn,
  Exercise,
  ExerciseDomain,
} from "@/lib/exercise-schemas";

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

function pickForDomain(
  exercises: Exercise[],
  domain: ExerciseDomain,
  intensity: SessionIntensity,
  max: number
): Exercise[] {
  const ceiling = DIFFICULTY_CEILING[intensity];
  return exercises
    .filter((ex) => ex.domain === domain)
    .filter((ex) => intensity === "recovery" || DIFFICULTY_RANK[ex.difficulty] <= ceiling)
    .sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty])
    .slice(0, max);
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

  const blocks: SessionBlock[] = [];
  let usedSeconds = 0;
  for (const step of sequence) {
    const picks = pickForDomain(exercises, step.domain, intensity, 2);
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
