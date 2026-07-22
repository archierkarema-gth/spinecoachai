import type { Exercise } from "@/lib/exercise-schemas";
import type { AsymmetryLog, SessionLog } from "@/lib/log-schemas";
import type { User } from "@/lib/schemas";

/**
 * M16 progression engine (spec §6, §6B). Pure and deterministic — no network,
 * no model. Promotion is decided ONLY from logged SessionLog data (spec §6.2);
 * there is no manual promotion. Safety gates (PT clearance, contraindication)
 * always win over performance readiness.
 *
 * Clinical guardrails carried through (docs/04, docs/12, owner memory):
 *  - never claims or projects a Cobb-angle change — capability only;
 *  - asymmetry/rib-hump signals feed "cek PT" language, never "curve worsening".
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PROMOTE_WINDOW = 5; // trailing sessions containing the exercise (§6.3)
const PROMOTE_QUALIFY = 3; // sessions that must meet performance (§6.3.1)
const FORM_MIN = 4; // §6.3.2
const RPE_MAX = 8; // §6.3.3
const SYMMETRY_LOOKBACK_DAYS = 7; // §6.3.5
const DEMOTE_STREAK = 3; // §6.4

// ---------------------------------------------------------------------------
// Family position
// ---------------------------------------------------------------------------

/** Every exercise in a family, ordered entry→elite by level then chain. */
export function familyMembers(
  family: string,
  exercises: Exercise[]
): Exercise[] {
  return exercises
    .filter((e) => e.family === family)
    .sort((a, b) => (a.level ?? 1) - (b.level ?? 1));
}

/**
 * The exercise the user is currently on in a family: the highest-level member
 * they have any SessionLog for; if none logged yet, the family's entry move
 * (lowest level). Deterministic source of "current position" with no new store.
 */
export function activeExerciseForFamily(
  family: string,
  exercises: Exercise[],
  sessionLogs: SessionLog[]
): Exercise | undefined {
  const members = familyMembers(family, exercises);
  if (members.length === 0) return undefined;
  const loggedIds = new Set(sessionLogs.map((l) => l.exerciseId));
  const logged = members.filter((m) => loggedIds.has(m.id));
  if (logged.length === 0) return members[0];
  return logged.reduce((hi, m) => ((m.level ?? 1) >= (hi.level ?? 1) ? m : hi));
}

/** familyCurrentLevel (spec §6.1) — level of the active exercise. */
export function familyCurrentLevel(
  family: string,
  exercises: Exercise[],
  sessionLogs: SessionLog[]
): number {
  const active = activeExerciseForFamily(family, exercises, sessionLogs);
  return active?.level ?? 1;
}

// ---------------------------------------------------------------------------
// Auto-promotion (§6.3)
// ---------------------------------------------------------------------------

export type PromotionBlock = "pt-clearance" | "contraindicated" | null;

export interface PromotionResult {
  exerciseId: string;
  nextId: string | null;
  /** Physically qualified per rules 1–5 (regardless of safety gate). */
  ready: boolean;
  /** Ready AND the safety gate (rules 6–7) allows it. */
  promote: boolean;
  blockedBy: PromotionBlock;
  reasons: string[];
}

function metPerformance(log: SessionLog, ex: Exercise): boolean {
  if (ex.holdSeconds != null) {
    return log.holdSecondsDone != null && log.holdSecondsDone >= ex.holdSeconds;
  }
  if (ex.repTargetMax != null) {
    return log.repsDone != null && log.repsDone >= ex.repTargetMax;
  }
  return false; // no target set → cannot auto-promote on performance
}

/** True if any lateralized (left/right) asymmetry was logged in the window. */
export function hasRecentLateralAsymmetry(
  asymmetryLogs: AsymmetryLog[],
  now: number,
  days = SYMMETRY_LOOKBACK_DAYS
): boolean {
  const cutoff = now - days * MS_PER_DAY;
  return asymmetryLogs.some(
    (l) =>
      l.createdAt >= cutoff && (l.side === "left" || l.side === "right")
  );
}

/**
 * Evaluate promotion for one exercise (spec §6.3). Evaluated over the trailing
 * `PROMOTE_WINDOW` sessions that contain this exercise. `sessionLogs` may be
 * all of the user's logs (any order) — this filters and sorts internally.
 */
export function evaluatePromotion(
  exercise: Exercise,
  sessionLogs: SessionLog[],
  asymmetryLogs: AsymmetryLog[],
  user: User,
  exercises: Exercise[],
  now: number
): PromotionResult {
  const nextId = exercise.progressionNextId ?? exercise.progressionId ?? null;
  const reasons: string[] = [];
  const base: PromotionResult = {
    exerciseId: exercise.id,
    nextId,
    ready: false,
    promote: false,
    blockedBy: null,
    reasons,
  };
  if (!nextId) {
    reasons.push("Sudah di puncak rantai — tidak ada progresi berikutnya.");
    return base;
  }

  const window = sessionLogs
    .filter((l) => l.exerciseId === exercise.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, PROMOTE_WINDOW);

  // Rule 1 performance: qualifying = sessions meeting reps/hold target.
  const qualifying = window.filter((l) => metPerformance(l, exercise));
  if (qualifying.length < PROMOTE_QUALIFY) {
    reasons.push(
      `Belum ${PROMOTE_QUALIFY}× capai target performa dalam 5 sesi terakhir.`
    );
    return base;
  }
  // Rules 2–4 on the qualifying sessions.
  const cleanForm = qualifying.every((l) => l.formRating >= FORM_MIN);
  const controlledRpe = qualifying.every((l) => l.rpe <= RPE_MAX);
  const mirrorOk =
    !exercise.mirrorCheckRequired ||
    qualifying.every((l) => l.mirrorCheckPass === true);
  if (!cleanForm) reasons.push("Form belum konsisten ≥4/5 pada sesi kualifikasi.");
  if (!controlledRpe)
    reasons.push("RPE masih >8 (grinding) — belum terkendali untuk naik level.");
  if (!mirrorOk) reasons.push("Mirror check belum lolos pada sesi kualifikasi.");
  // Rule 5 symmetry.
  const asymmetryClear = !hasRecentLateralAsymmetry(asymmetryLogs, now);
  if (!asymmetryClear)
    reasons.push("Ada catatan nyeri satu sisi dalam 7 hari — tahan dulu naik level.");

  const ready = cleanForm && controlledRpe && mirrorOk && asymmetryClear;
  if (!ready) return base;

  // Rules 6–7 safety gate — physically ready, but may be locked.
  const next = exercises.find((e) => e.id === nextId);
  if (next?.contraindicated) {
    reasons.push(
      "Siap secara fisik, tapi gerakan berikutnya tidak direkomendasikan untuk profilmu."
    );
    return { ...base, ready: true, blockedBy: "contraindicated" };
  }
  if (next?.requiresPTClearance && !user.ptCleared) {
    reasons.push(
      "Siap secara fisik, terkunci: butuh PT-clearance untuk gerakan berikutnya."
    );
    return { ...base, ready: true, blockedBy: "pt-clearance" };
  }

  reasons.push("Semua syarat terpenuhi — siap naik ke progresi berikutnya.");
  return { ...base, ready: true, promote: true };
}

// ---------------------------------------------------------------------------
// Auto-demotion suggestion (§6.4) — suggests, never forces.
// ---------------------------------------------------------------------------

export interface DemotionResult {
  exerciseId: string;
  prevId: string | null;
  suggestDemote: boolean;
  reason: string | null;
}

export function evaluateDemotion(
  exercise: Exercise,
  sessionLogs: SessionLog[],
  asymmetryLogs: AsymmetryLog[],
  now: number
): DemotionResult {
  const prevId = exercise.progressionPrevId ?? exercise.regressionId ?? null;
  const out: DemotionResult = {
    exerciseId: exercise.id,
    prevId,
    suggestDemote: false,
    reason: null,
  };
  if (!prevId) return out;

  const recent = sessionLogs
    .filter((l) => l.exerciseId === exercise.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  const lastN = recent.slice(0, DEMOTE_STREAK);
  const belowMin =
    exercise.repTargetMin != null &&
    lastN.length === DEMOTE_STREAK &&
    lastN.every(
      (l) => l.repsDone != null && l.repsDone < (exercise.repTargetMin ?? 0)
    );
  const poorForm =
    lastN.length === DEMOTE_STREAK && lastN.every((l) => l.formRating <= 2);
  const repeatedAsymmetry = repeatedSameSideAsymmetry(asymmetryLogs, now);

  if (belowMin) out.reason = "Reps di bawah target minimum 3 sesi berturut.";
  else if (poorForm) out.reason = "Form ≤2/5 berulang.";
  else if (repeatedAsymmetry)
    out.reason = "Nyeri satu sisi berulang — turunkan dulu, konfirmasi ke PT.";
  out.suggestDemote = out.reason != null;
  return out;
}

/** ≥3 same-side (left/right) asymmetry entries in the trailing 7 days. */
export function repeatedSameSideAsymmetry(
  asymmetryLogs: AsymmetryLog[],
  now: number,
  days = SYMMETRY_LOOKBACK_DAYS
): boolean {
  const cutoff = now - days * MS_PER_DAY;
  let left = 0;
  let right = 0;
  for (const l of asymmetryLogs) {
    if (l.createdAt < cutoff) continue;
    if (l.side === "left") left++;
    if (l.side === "right") right++;
  }
  return left >= DEMOTE_STREAK || right >= DEMOTE_STREAK;
}

// ---------------------------------------------------------------------------
// Asymmetry alert (§6.6) — neutral language, never "curve worsening".
// ---------------------------------------------------------------------------

export interface AsymmetryAlert {
  raised: boolean;
  message: string | null;
}

export function asymmetryAlert(
  asymmetryLogs: AsymmetryLog[],
  now: number
): AsymmetryAlert {
  if (repeatedSameSideAsymmetry(asymmetryLogs, now)) {
    return {
      raised: true,
      // §6.6: NO "kurva memburuk" — self-report is noisy.
      message:
        "Pola nyeri satu sisi berulang. Sarankan deload + cek ke PT — ini bukan penilaian klinis, hanya pola yang perlu diperiksa.",
    };
  }
  return { raised: false, message: null };
}

// ---------------------------------------------------------------------------
// 6-month projection (§6B) — projection only, never lowers §6.3 requirements.
// ---------------------------------------------------------------------------

export type ProjectionStatus =
  | "achieved"
  | "on-track"
  | "slightly-behind"
  | "behind";

export interface Projection {
  targetLevel: number;
  targetDate: number;
  familyCurrentLevel: number;
  paceActual: number; // levels per week
  paceRequired: number;
  status: ProjectionStatus;
}

const TARGET_LEVEL = 3;
const TARGET_WEEKS = 26; // ~6 months (spec §6B.4)
const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * Projected pace toward minimum Level 3 in 6 months for a FOUNDATIONAL family
 * (spec §6B.4). Skill-line families call this with a longer horizon or skip the
 * "behind" status entirely (spec §6B.3) — that is the caller's choice; this
 * only computes pace, it never gates promotion.
 */
export function projectFamily(
  startDate: number,
  currentLevel: number,
  now: number,
  targetWeeks = TARGET_WEEKS
): Projection {
  const targetDate = startDate + targetWeeks * MS_PER_WEEK;
  const levelsGained = currentLevel - 1;
  const weeksElapsed = Math.max((now - startDate) / MS_PER_WEEK, 0);
  const paceActual = weeksElapsed > 0 ? levelsGained / weeksElapsed : 0;
  const paceRequired = (TARGET_LEVEL - 1) / targetWeeks;

  let status: ProjectionStatus;
  if (currentLevel >= TARGET_LEVEL) status = "achieved";
  else if (weeksElapsed === 0) status = "on-track"; // day 0 — no verdict yet
  else if (paceActual >= paceRequired) status = "on-track";
  else if (paceActual >= paceRequired * 0.6) status = "slightly-behind";
  else status = "behind";

  return {
    targetLevel: TARGET_LEVEL,
    targetDate,
    familyCurrentLevel: currentLevel,
    paceActual,
    paceRequired,
    status,
  };
}

/** Neutral diagnosis for a behind family (spec §6B.4) — never "lower the bar". */
export function projectionDiagnosis(status: ProjectionStatus): string | null {
  if (status !== "behind") return null;
  return "Tertinggal pace. Cek: konsistensi (sesi terlewat?) atau kesiapan (form/asimetri menahan unlock?). Deload/istirahat karena asimetri = alasan sah, bukan kegagalan.";
}
