import type { Exercise } from "@/lib/exercise-schemas";
import type { AsymmetryLog, SessionLog } from "@/lib/log-schemas";
import type { User } from "@/lib/schemas";
import {
  activeExerciseForFamily,
  asymmetryAlert,
  familyCurrentLevel,
  projectFamily,
  type AsymmetryAlert,
  type Projection,
} from "@/lib/progression";

/**
 * M16 dashboard view models (spec §7). Pure aggregation over the progression
 * engine — no storage, no rendering. Turns raw logs into the progression map
 * and safety strip the dashboard shows.
 */

/** Human labels for the foundational families (spec §6B.2). */
const FAMILY_LABELS: Record<string, string> = {
  "ex-wall-pushup": "Push (horizontal)",
  "ex-dip-support-hold": "Dip",
  "ex-dead-hang": "Pull-up / Hang",
  "ex-table-row": "Row",
  "ex-wall-sit": "Squat",
  "ex-glute-bridge": "Hinge / Glute",
  "ex-clamshell-raise": "Aktivasi glute",
  "ex-calf-raise": "Calf",
  "ex-front-plank-knees": "Plank",
  "ex-side-plank-knees-left": "Side plank (kiri)",
  "ex-side-plank-knees-right": "Side plank (kanan)",
  "ex-l-sit-foot-supported": "L-sit",
  "ex-scapular-wall-slide": "Scapular",
  hollow: "Hollow",
  pallof: "Pallof",
  serratus: "Serratus",
};

export function familyLabel(family: string): string {
  return FAMILY_LABELS[family] ?? family;
}

export type NextLock = "pt-clearance" | "contraindicated" | null;

export interface FamilyProgress {
  family: string;
  label: string;
  currentLevel: number;
  activeName: string;
  nextName: string | null;
  locked: NextLock;
  projection: Projection;
}

/**
 * Progression map for every FOUNDATIONAL family present in the library
 * (spec §7). `startDate` for the 6-month projection uses `user.createdAt` as a
 * proxy — the app stores no per-family start date. Skill-line families are
 * excluded here (spec §6B.3 — they have no 6-month deadline).
 */
export function buildProgressionMap(
  exercises: Exercise[],
  sessionLogs: SessionLog[],
  user: User,
  now: number
): FamilyProgress[] {
  const families = new Set(
    exercises.filter((e) => e.isFoundational && e.family).map((e) => e.family as string)
  );
  const rows: FamilyProgress[] = [];
  for (const family of families) {
    const active = activeExerciseForFamily(family, exercises, sessionLogs);
    if (!active) continue;
    const currentLevel = familyCurrentLevel(family, exercises, sessionLogs);
    const nextId = active.progressionNextId ?? active.progressionId ?? null;
    const next = nextId ? exercises.find((e) => e.id === nextId) : undefined;
    let locked: NextLock = null;
    if (next?.contraindicated) locked = "contraindicated";
    else if (next?.requiresPTClearance && !user.ptCleared) locked = "pt-clearance";
    rows.push({
      family,
      label: familyLabel(family),
      currentLevel,
      activeName: active.name,
      nextName: next?.name ?? null,
      locked,
      projection: projectFamily(user.createdAt, currentLevel, now),
    });
  }
  // Behind first (needs attention), then by label for stability.
  const order = { behind: 0, "slightly-behind": 1, "on-track": 2, achieved: 3 };
  return rows.sort(
    (a, b) =>
      order[a.projection.status] - order[b.projection.status] ||
      a.label.localeCompare(b.label)
  );
}

export interface SafetyStrip {
  ptCleared: boolean;
  unreviewed: number;
  alert: AsymmetryAlert;
}

/** Safety strip (spec §7): PT-clearance flag, unreviewed asymmetry count, alert. */
export function buildSafetyStrip(
  user: User,
  asymmetryLogs: AsymmetryLog[],
  now: number
): SafetyStrip {
  return {
    ptCleared: user.ptCleared === true,
    unreviewed: asymmetryLogs.filter((l) => !l.reviewed).length,
    alert: asymmetryAlert(asymmetryLogs, now),
  };
}
