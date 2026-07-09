import type { WorkoutLog, PainLog } from "@/lib/log-schemas";

/**
 * Pure progress calculations for the Progress dashboard. No storage or UI —
 * kept testable and separate from the React layer.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Start-of-day timestamp (local) for a given ms epoch. */
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Consecutive-day training streak ending today (or yesterday). Multiple
 * sessions on one day count once. Returns 0 if the most recent session is
 * older than yesterday.
 */
export function computeStreak(
  logs: WorkoutLog[],
  now: number = Date.now()
): number {
  if (logs.length === 0) return 0;

  const days = new Set(logs.map((l) => startOfDay(l.createdAt)));
  const today = startOfDay(now);

  // Streak may end today or yesterday; otherwise it's broken.
  let cursor: number;
  if (days.has(today)) cursor = today;
  else if (days.has(today - DAY_MS)) cursor = today - DAY_MS;
  else return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

/** Count of sessions whose timestamp falls within the last `days` days. */
export function sessionsInLastDays(
  logs: WorkoutLog[],
  days: number,
  now: number = Date.now()
): number {
  const cutoff = now - days * DAY_MS;
  return logs.filter((l) => l.createdAt >= cutoff).length;
}

/**
 * Pain levels ordered oldest → newest, for a sparkline. Reads from pain logs
 * plus any post-session pain reported on workout logs.
 */
export function painTrend(
  painLogs: PainLog[],
  workoutLogs: WorkoutLog[]
): { createdAt: number; painLevel: number }[] {
  const points = [
    ...painLogs.map((p) => ({ createdAt: p.createdAt, painLevel: p.painLevel })),
    ...workoutLogs
      .filter((w) => w.postSessionPain !== undefined)
      .map((w) => ({
        createdAt: w.createdAt,
        painLevel: w.postSessionPain as number,
      })),
  ];
  return points.sort((a, b) => a.createdAt - b.createdAt);
}
