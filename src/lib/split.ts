import type { Exercise } from "@/lib/exercise-schemas";
import type { SessionLog } from "@/lib/log-schemas";
import { activeExerciseForFamily } from "@/lib/progression";

/**
 * M16 fixed weekly split (spec §5). Replaces the old pain/recovery-gated
 * dynamic session: the day of week determines the workout, progression state
 * determines which rung of each family is prescribed. Pure and deterministic.
 *
 * Schroth breathing DIRECTION is authored (safe geometry, spec §1). Strengthen/
 * stretch/rotation SIDE stays PENDING_PT on the underlying exercise records —
 * this engine never fabricates a side.
 */

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type BlockKind = "prep" | "main" | "schroth" | "finisher";

interface BlockSpec {
  label: string;
  kind: BlockKind;
  /** Progression families — resolved to the user's current rung. */
  families?: string[];
  /** Explicit exercise ids (standalone prep/scap/schroth/finisher moves). */
  exerciseIds?: string[];
}

export interface DayTemplate {
  day: Weekday;
  title: string;
  focus: string;
  blocks: BlockSpec[];
}

/**
 * Fixed Senin–Sabtu split (spec §5). Format each day:
 *   Prep/Scap → Main progression → Schroth integration → Finisher.
 * Minggu = rest / deload week entry point (spec §5 "MINGGU 7 — DELOAD").
 */
export const WEEK: Record<Weekday, DayTemplate | null> = {
  mon: {
    day: "mon",
    title: "PUSH — Dada + Triceps",
    focus: "Push",
    blocks: [
      { label: "Prep & Skapula", kind: "prep", exerciseIds: ["ex-wrist-prep", "ex-scapular-pushup"] },
      { label: "Push utama", kind: "main", families: ["ex-wall-pushup", "ex-dip-support-hold"] },
      {
        label: "Schroth — napas KANAN atas (konkaf T1–T5)",
        kind: "schroth",
        exerciseIds: ["ex-schroth-breathing-upper"],
      },
      { label: "Finisher", kind: "finisher", families: ["planche"] },
    ],
  },
  tue: {
    day: "tue",
    title: "PULL — Punggung + Biceps",
    focus: "Pull",
    blocks: [
      { label: "Skapula", kind: "prep", exerciseIds: ["ex-scapular-pull"] },
      {
        label: "Pull utama",
        kind: "main",
        families: ["ex-dead-hang", "ex-table-row", "front-lever"],
      },
      { label: "Anti-rotasi", kind: "schroth", families: ["pallof"] },
      { label: "Finisher — dekompresi", kind: "finisher", exerciseIds: ["ex-dead-hang"] },
    ],
  },
  wed: {
    day: "wed",
    title: "LEGS & GLUTES + Kegel + Panggul",
    focus: "Legs",
    blocks: [
      { label: "Aktivasi", kind: "prep", families: ["ex-clamshell-raise"] },
      {
        label: "Legs utama",
        kind: "main",
        families: ["ex-wall-sit", "ex-glute-bridge", "ex-calf-raise"],
      },
      {
        label: "Schroth — panggul netral (arah PENDING_PT)",
        kind: "schroth",
        exerciseIds: ["ex-schroth-pelvic-correction", "ex-kegel-dasar"],
      },
      { label: "Finisher — anti-lateral-flexion", kind: "finisher", exerciseIds: ["ex-suitcase-carry"] },
    ],
  },
  thu: {
    day: "thu",
    title: "CORE & SCHROTH DEEP",
    focus: "Core + Schroth",
    blocks: [
      {
        label: "Schroth intensif (napas dikoreksi + korektif PENDING_PT)",
        kind: "schroth",
        exerciseIds: [
          "ex-schroth-breathing-upper",
          "ex-schroth-breathing-lower",
          "ex-schroth-pelvic-correction",
          "ex-prone-derotation",
          "ex-side-lying-corrective",
        ],
      },
      {
        label: "Core",
        kind: "main",
        families: ["hollow", "pallof", "ex-front-plank-knees", "ex-l-sit-foot-supported"],
      },
      {
        label: "Quality drills (mirror check)",
        kind: "finisher",
        exerciseIds: ["ex-dead-bug", "ex-bird-dog"],
      },
    ],
  },
  fri: {
    day: "fri",
    title: "PUSH (Bahu/Deltoid) + Schroth Skapula",
    focus: "Push (shoulder)",
    blocks: [
      {
        label: "Prep & Skapula (serratus)",
        kind: "prep",
        exerciseIds: ["ex-wrist-prep", "ex-scapular-pushup", "ex-scapular-wall-slide", "ex-serratus-punch"],
      },
      { label: "Overhead push", kind: "main", families: ["overhead-push", "ex-l-sit-foot-supported"] },
      { label: "Schroth — setting skapula simetris", kind: "schroth", exerciseIds: ["ex-wall-angel"] },
      { label: "Finisher — serratus", kind: "finisher", families: ["serratus"] },
    ],
  },
  sat: {
    day: "sat",
    title: "FULL BODY PULL + MOBILITY + Kegel",
    focus: "Active recovery",
    blocks: [
      { label: "Skapula", kind: "prep", exerciseIds: ["ex-scapular-pull"] },
      {
        label: "Circuit ringan",
        kind: "main",
        families: ["ex-table-row"],
      },
      {
        label: "Mobility (hindari apex T3–T4 & T8–T9)",
        kind: "schroth",
        exerciseIds: ["ex-thoracic-extension-support", "ex-cat-cow"],
      },
      { label: "Finisher — dead hang + Kegel", kind: "finisher", exerciseIds: ["ex-dead-hang", "ex-kegel-dasar"] },
    ],
  },
  sun: null, // rest / deload week entry
};

const WEEKDAY_ORDER: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Local weekday key for a Date (or ms timestamp). */
export function weekdayOf(date: Date | number): Weekday {
  const d = typeof date === "number" ? new Date(date) : date;
  return WEEKDAY_ORDER[d.getDay()];
}

export interface ResolvedBlock {
  label: string;
  kind: BlockKind;
  exercises: Exercise[];
  /** Any exercise ids referenced by the template but missing from the library. */
  missing: string[];
}

export interface ResolvedDay {
  day: Weekday;
  title: string;
  focus: string;
  blocks: ResolvedBlock[];
  isRest: boolean;
}

/**
 * Resolve a day's template to concrete exercises. Families resolve to the
 * user's current rung (from SessionLog history via `activeExerciseForFamily`);
 * explicit ids resolve directly. Missing ids are reported, never silently
 * dropped — so a seeding gap is visible rather than a blank block.
 */
export function resolveDay(
  day: Weekday,
  exercises: Exercise[],
  sessionLogs: SessionLog[]
): ResolvedDay {
  const template = WEEK[day];
  if (!template) {
    return {
      day,
      title: "Istirahat",
      focus: "Rest / deload",
      blocks: [],
      isRest: true,
    };
  }
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const blocks: ResolvedBlock[] = template.blocks.map((spec) => {
    const picked: Exercise[] = [];
    const missing: string[] = [];
    for (const fam of spec.families ?? []) {
      const active = activeExerciseForFamily(fam, exercises, sessionLogs);
      if (active) picked.push(active);
      else missing.push(`family:${fam}`);
    }
    for (const id of spec.exerciseIds ?? []) {
      const ex = byId.get(id);
      if (ex) picked.push(ex);
      else missing.push(id);
    }
    return { label: spec.label, kind: spec.kind, exercises: picked, missing };
  });
  return {
    day,
    title: template.title,
    focus: template.focus,
    blocks,
    isRest: false,
  };
}

/** Resolve today's session for a timestamp (defaults to now). */
export function resolveToday(
  exercises: Exercise[],
  sessionLogs: SessionLog[],
  now: number = Date.now()
): ResolvedDay {
  return resolveDay(weekdayOf(now), exercises, sessionLogs);
}
