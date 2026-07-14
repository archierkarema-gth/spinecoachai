# M12 — Objective Progress Dashboard: Plank Benchmark

Status: Approved
Date: 2026-07-14

## Problem

Progress page (`src/app/progress/page.tsx`) shows streak, session count, and
pain trend — all derived from workout completion (`completed: boolean`), not
from any objective performance measure. `completedExercise` has no reps, hold
duration, or load field, so functional metrics like plank max, push-up max,
or dead-hang max have no data source today.

## Scope

Ship one objective metric: **plank hold (seconds)**, logged via a dedicated
benchmark test, displayed on the existing Progress page. Schema is built to
hold future benchmark types (push-up, dead-hang) without a breaking
migration, but only `plank_hold` ships now (YAGNI on the rest).

Out of scope: push-up/dead-hang tests, workout-captured performance data,
live count-up timer UI, Supabase sync of benchmark logs (stays IndexedDB,
same tier as workout/pain logs).

## Data model

New schema in `src/lib/log-schemas.ts`:

```ts
export const benchmarkTypeEnum = z.enum(["plank_hold"]);

export const benchmarkLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  type: benchmarkTypeEnum,
  value: z.number().positive(), // seconds for plank_hold
  note: z.string().max(300).optional(),
});
export type BenchmarkLog = z.infer<typeof benchmarkLogSchema>;

export const newBenchmarkLogInputSchema = benchmarkLogSchema.omit({
  id: true,
  createdAt: true,
});
export type NewBenchmarkLogInput = z.infer<typeof newBenchmarkLogInputSchema>;
```

Adding a future benchmark type = add an enum value + a label; no schema
rewrite, no migration of existing rows (`value`'s unit is implied by `type`).

## Storage (`src/lib/db.ts`)

- New object store `benchmarkLogs`, keyPath `id`, index `by-userId`.
- `DB_VERSION` bumps 4 → 5; add `if (oldVersion < 5)` upgrade block creating
  the store + index, following the existing versioned-upgrade pattern.
- `putBenchmarkLog(log: BenchmarkLog): Promise<void>`
- `getBenchmarkLogsForUser(userId: string): Promise<BenchmarkLog[]>` — newest
  first, mirrors `getPainLogsForUser`.
- Add `"benchmarkLogs"` to the `resetUserData` store list.

## Store (`src/lib/store.ts`)

- Add `benchmarkLogs: BenchmarkLog[]` to `AppState`.
- Load in `hydrate()` alongside workout logs.
- Add `refreshBenchmarks(): Promise<void>`, same shape as `refreshLogs`.

## Pure calculations (`src/lib/progress.ts`)

No storage or UI — testable in isolation, same convention as existing
`computeStreak` / `painTrend`:

- `latestBenchmark(logs: BenchmarkLog[], type: BenchmarkType): number | null`
  — most recent value for that type, or null if none.
- `personalBest(logs: BenchmarkLog[], type: BenchmarkType): number | null`
  — max value for that type, or null if none.
- `benchmarkTrend(logs: BenchmarkLog[], type: BenchmarkType): { createdAt: number; value: number }[]`
  — oldest → newest, filtered to `type`, for the Sparkline.

## UI (`src/app/progress/page.tsx`)

New "Tes plank" card, placed after the pain-trend card:

- Current (latest) value and personal-best badge, in seconds.
- `Sparkline` of `benchmarkTrend` values.
- Empty state ("Belum ada tes plank tercatat.") when no logs exist.
- "Catat tes" button opens a small entry sheet: numeric seconds input
  (required, positive) + optional note. On submit: build
  `NewBenchmarkLogInput`, `putBenchmarkLog`, then `refreshBenchmarks()`.

Entry is manual numeric input for this milestone — no live count-up timer.
(`use-countdown` counts down; plank endurance needs count-up, a different
component. Deferred to its own milestone if wanted later.)

## Testing

TDD, pure functions first:

- `src/lib/__tests__/progress.test.ts` (or existing file): cases for
  `latestBenchmark`, `personalBest`, `benchmarkTrend` — empty logs, single
  entry, multiple entries mixed with unrelated future types, ordering.
- Extend any existing db/schema integrity tests to cover
  `benchmarkLogSchema` validation (positive value, enum type).

## Risks / notes

- `DB_VERSION` bump requires the upgrade block to be additive-only (no
  destructive changes to existing stores) — consistent with v2/v3/v4 history
  in `db.ts`.
- Keep card Bahasa Indonesia copy consistent with rest of Progress page.
