import type {
  BenchmarkLog,
  BenchmarkType,
  PainLog,
  WorkoutLog,
} from "@/lib/log-schemas";
import type { ExerciseDomain } from "@/lib/exercise-schemas";

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

/** Most recent value logged for a benchmark type, or null if none exist. */
export function latestBenchmark(
  logs: BenchmarkLog[],
  type: BenchmarkType
): number | null {
  const matching = logs.filter((l) => l.type === type);
  if (matching.length === 0) return null;
  return matching.reduce((latest, l) =>
    l.createdAt > latest.createdAt ? l : latest
  ).value;
}

/** Highest value ever logged for a benchmark type, or null if none exist. */
export function personalBest(
  logs: BenchmarkLog[],
  type: BenchmarkType
): number | null {
  const values = logs.filter((l) => l.type === type).map((l) => l.value);
  if (values.length === 0) return null;
  return Math.max(...values);
}

/** Benchmark values for a type, ordered oldest → newest, for a trend graph. */
export function benchmarkTrend(
  logs: BenchmarkLog[],
  type: BenchmarkType
): { createdAt: number; value: number }[] {
  return logs
    .filter((l) => l.type === type)
    .map((l) => ({ createdAt: l.createdAt, value: l.value }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

const ALL_DOMAINS: ExerciseDomain[] = [
  "breathing",
  "mobility",
  "stability",
  "core",
  "balance",
  "strength",
  "conditioning",
  "recovery",
];

/**
 * Minutes of training per domain over the last 7 days, from workoutLogs.
 * A log's estimatedMinutes is split evenly across the domains it touched
 * (logs don't record per-exercise duration) — display-only signal for the
 * Progress page (M14 P3-lite); never consumed by generateSession.
 */
export function weeklyVolumeByDomain(
  logs: WorkoutLog[],
  now: number = Date.now()
): Record<ExerciseDomain, number> {
  const result = Object.fromEntries(
    ALL_DOMAINS.map((d) => [d, 0])
  ) as Record<ExerciseDomain, number>;
  const cutoff = now - 7 * DAY_MS;
  for (const log of logs) {
    if (log.createdAt < cutoff) continue;
    const domains = [...new Set(log.exercises.map((e) => e.domain))];
    if (domains.length === 0) continue;
    const perDomain = log.estimatedMinutes / domains.length;
    for (const d of domains) {
      result[d] += perDomain;
    }
  }
  return result;
}
