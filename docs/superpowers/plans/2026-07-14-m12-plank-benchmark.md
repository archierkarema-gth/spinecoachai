# M12 — Plank Benchmark & Trend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a plank-hold benchmark test (seconds) with personal-best and trend display on the Progress page, backed by an extensible `BenchmarkLog` schema.

**Architecture:** New Zod schema + IndexedDB store (`benchmarkLogs`, `DB_VERSION` 4→5) mirror the existing `PainLog` pattern exactly. Pure calculation functions live in `src/lib/progress.ts` next to `computeStreak`/`painTrend`. UI is an inline entry form + `Sparkline` card on `src/app/progress/page.tsx`, following the inline-form pattern already used on `src/app/pain/page.tsx` (no popup/sheet component exists in this codebase — don't invent one).

**Tech Stack:** Next.js (App Router), Zod, `idb` (IndexedDB wrapper), Zustand, Vitest + `fake-indexeddb`.

## Global Constraints

- Schema: `benchmarkTypeEnum` is a Zod enum with only `"plank_hold"` today; adding a future type must not require a migration.
- `value` field is `z.number().positive()` (seconds for `plank_hold`).
- `DB_VERSION` upgrade blocks are additive-only — never touch existing stores' data.
- All new user-facing copy is in Bahasa Indonesia, consistent with the rest of the Progress page.
- No live count-up timer — manual numeric seconds entry only, this milestone.
- Follow the `PainLog` code path 1:1 wherever this spec doesn't say otherwise (schema shape, db helper naming, store wiring, UI layout) — it is the closest existing analog.

---

### Task 1: `BenchmarkLog` schema

**Files:**
- Modify: `src/lib/log-schemas.ts`
- Test: `src/lib/__tests__/schemas.test.ts`

**Interfaces:**
- Produces: `benchmarkTypeEnum` (Zod enum), `BenchmarkType` (type), `benchmarkLogSchema` (Zod object), `BenchmarkLog` (type), `newBenchmarkLogInputSchema` (Zod object, omits `id`/`createdAt`), `NewBenchmarkLogInput` (type). All exported from `@/lib/log-schemas`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/schemas.test.ts`:

```ts
import {
  benchmarkLogSchema,
  newBenchmarkLogInputSchema,
} from "@/lib/log-schemas";

describe("benchmarkLogSchema", () => {
  const validLog = {
    id: "b1",
    userId: "user-1",
    createdAt: 1000,
    type: "plank_hold" as const,
    value: 45,
  };

  it("accepts a valid plank_hold log", () => {
    expect(benchmarkLogSchema.safeParse(validLog).success).toBe(true);
  });

  it("accepts an optional note", () => {
    const result = benchmarkLogSchema.safeParse({ ...validLog, note: "Terasa lebih kuat" });
    expect(result.success).toBe(true);
  });

  it("rejects a zero value", () => {
    expect(benchmarkLogSchema.safeParse({ ...validLog, value: 0 }).success).toBe(false);
  });

  it("rejects a negative value", () => {
    expect(benchmarkLogSchema.safeParse({ ...validLog, value: -5 }).success).toBe(false);
  });

  it("rejects an unknown type", () => {
    expect(benchmarkLogSchema.safeParse({ ...validLog, type: "push_up" }).success).toBe(false);
  });
});

describe("newBenchmarkLogInputSchema", () => {
  it("accepts a payload without id and createdAt", () => {
    const input = { userId: "user-1", type: "plank_hold" as const, value: 30 };
    expect(newBenchmarkLogInputSchema.safeParse(input).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/schemas.test.ts`
Expected: FAIL — `benchmarkLogSchema` / `newBenchmarkLogInputSchema` not exported from `@/lib/log-schemas`.

- [ ] **Step 3: Implement the schema**

Append to `src/lib/log-schemas.ts` (after `newPainLogInputSchema`):

```ts
export const benchmarkTypeEnum = z.enum(["plank_hold"]);
export type BenchmarkType = z.infer<typeof benchmarkTypeEnum>;

export const benchmarkLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  type: benchmarkTypeEnum,
  value: z.number().positive(),
  note: z.string().max(300).optional(),
});
export type BenchmarkLog = z.infer<typeof benchmarkLogSchema>;

export const newBenchmarkLogInputSchema = benchmarkLogSchema.omit({
  id: true,
  createdAt: true,
});
export type NewBenchmarkLogInput = z.infer<typeof newBenchmarkLogInputSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/schemas.test.ts`
Expected: PASS, all `benchmarkLogSchema`/`newBenchmarkLogInputSchema` tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/log-schemas.ts src/lib/__tests__/schemas.test.ts
git commit -m "feat: add BenchmarkLog schema for plank hold tracking"
```

---

### Task 2: `benchmarkLogs` IndexedDB store + helpers

**Files:**
- Modify: `src/lib/db.ts`
- Test: `src/lib/__tests__/db.test.ts`

**Interfaces:**
- Consumes: `BenchmarkLog` type from Task 1 (`@/lib/log-schemas`).
- Produces: `putBenchmarkLog(log: BenchmarkLog): Promise<void>`, `getBenchmarkLogsForUser(userId: string): Promise<BenchmarkLog[]>` (newest first), both exported from `@/lib/db`. `resetUserData` clears `benchmarkLogs` too.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/db.test.ts`:

```ts
import { getBenchmarkLogsForUser, putBenchmarkLog } from "@/lib/db";

describe("benchmark logs", () => {
  it("stores benchmark logs and returns them newest first for a user", async () => {
    const older = {
      id: "bl1",
      userId: "u-bench",
      createdAt: 1000,
      type: "plank_hold" as const,
      value: 30,
    };
    const newer = {
      id: "bl2",
      userId: "u-bench",
      createdAt: 2000,
      type: "plank_hold" as const,
      value: 40,
    };

    await putBenchmarkLog(older);
    await putBenchmarkLog(newer);

    const all = await getBenchmarkLogsForUser("u-bench");
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe("bl2");
    expect(all[1].id).toBe("bl1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/db.test.ts`
Expected: FAIL — `putBenchmarkLog`/`getBenchmarkLogsForUser` not exported from `@/lib/db`, or store `benchmarkLogs` does not exist.

- [ ] **Step 3: Implement the store, upgrade block, and helpers**

In `src/lib/db.ts`:

1. Add import: change `import type { PainLog, WorkoutLog } from "@/lib/log-schemas";` to `import type { BenchmarkLog, PainLog, WorkoutLog } from "@/lib/log-schemas";`

2. Add to the `SpineCoachDB` interface (after `painLogs`):

```ts
  benchmarkLogs: {
    key: string;
    value: BenchmarkLog;
    indexes: { "by-userId": string };
  };
```

3. Change `const DB_VERSION = 4;` to `const DB_VERSION = 5;`

4. Add a new upgrade branch inside the `upgrade()` callback, after the existing `if (oldVersion >= 1 && oldVersion < 4)` block:

```ts
        if (oldVersion < 5) {
          const benchmarkLogs = db.createObjectStore("benchmarkLogs", {
            keyPath: "id",
          });
          benchmarkLogs.createIndex("by-userId", "userId");
        }
```

5. Add helpers after `getPainLogsForUser`:

```ts
export async function putBenchmarkLog(log: BenchmarkLog): Promise<void> {
  const db = await getDB();
  await db.put("benchmarkLogs", log);
}

/** Benchmark logs for a user, newest first. */
export async function getBenchmarkLogsForUser(
  userId: string
): Promise<BenchmarkLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("benchmarkLogs", "by-userId", userId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
```

6. Add `"benchmarkLogs"` to the `stores` array in `resetUserData`, after `"painLogs"`:

```ts
    "painLogs",
    "benchmarkLogs",
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/db.test.ts`
Expected: PASS, including the new "benchmark logs" describe block.

- [ ] **Step 5: Run the full test suite to confirm the version bump didn't break anything**

Run: `npx vitest run`
Expected: PASS, all existing suites green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/lib/__tests__/db.test.ts
git commit -m "feat: add benchmarkLogs IndexedDB store (DB_VERSION 5)"
```

---

### Task 3: Pure benchmark calculations in `progress.ts`

**Files:**
- Modify: `src/lib/progress.ts`
- Test: `src/lib/__tests__/progress.test.ts`

**Interfaces:**
- Consumes: `BenchmarkLog`, `BenchmarkType` from `@/lib/log-schemas` (Task 1).
- Produces: `latestBenchmark(logs: BenchmarkLog[], type: BenchmarkType): number | null`, `personalBest(logs: BenchmarkLog[], type: BenchmarkType): number | null`, `benchmarkTrend(logs: BenchmarkLog[], type: BenchmarkType): { createdAt: number; value: number }[]` (oldest → newest), all exported from `@/lib/progress`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/progress.test.ts`:

```ts
import {
  latestBenchmark,
  personalBest,
  benchmarkTrend,
} from "@/lib/progress";
import type { BenchmarkLog } from "@/lib/log-schemas";

function bench(createdAt: number, value: number, type: BenchmarkLog["type"] = "plank_hold"): BenchmarkLog {
  return { id: `b-${createdAt}`, userId: "u1", createdAt, type, value };
}

describe("latestBenchmark", () => {
  it("returns null with no logs", () => {
    expect(latestBenchmark([], "plank_hold")).toBeNull();
  });

  it("returns the most recent value for the given type", () => {
    const logs = [bench(1000, 30), bench(3000, 50), bench(2000, 40)];
    expect(latestBenchmark(logs, "plank_hold")).toBe(50);
  });
});

describe("personalBest", () => {
  it("returns null with no logs", () => {
    expect(personalBest([], "plank_hold")).toBeNull();
  });

  it("returns the max value for the given type", () => {
    const logs = [bench(1000, 30), bench(2000, 55), bench(3000, 40)];
    expect(personalBest(logs, "plank_hold")).toBe(55);
  });
});

describe("benchmarkTrend", () => {
  it("returns an empty array with no logs", () => {
    expect(benchmarkTrend([], "plank_hold")).toEqual([]);
  });

  it("returns points oldest to newest for the given type", () => {
    const logs = [bench(3000, 50), bench(1000, 30), bench(2000, 40)];
    expect(benchmarkTrend(logs, "plank_hold")).toEqual([
      { createdAt: 1000, value: 30 },
      { createdAt: 2000, value: 40 },
      { createdAt: 3000, value: 50 },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/progress.test.ts`
Expected: FAIL — `latestBenchmark`/`personalBest`/`benchmarkTrend` not exported from `@/lib/progress`.

- [ ] **Step 3: Implement the functions**

Append to `src/lib/progress.ts`:

```ts
import type { BenchmarkLog, BenchmarkType, PainLog, WorkoutLog } from "@/lib/log-schemas";
```

(Update the existing top import line to include `BenchmarkLog` and `BenchmarkType` rather than adding a second import line — the file currently has `import type { WorkoutLog, PainLog } from "@/lib/log-schemas";` at line 1; change it to the line above.)

Then append at the end of the file:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/progress.test.ts`
Expected: PASS, all new describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress.ts src/lib/__tests__/progress.test.ts
git commit -m "feat: add pure benchmark calculations (latest, PB, trend)"
```

---

### Task 4: Wire `benchmarkLogs` into the Zustand store

**Files:**
- Modify: `src/lib/store.ts`

**Interfaces:**
- Consumes: `BenchmarkLog` type (Task 1), `getBenchmarkLogsForUser` (Task 2).
- Produces: `useAppStore().benchmarkLogs: BenchmarkLog[]`, `useAppStore().refreshBenchmarks(): Promise<void>`.

There is no isolated unit to test here (Zustand store wiring is exercised through the UI in Task 5) — this task has no dedicated test step, per the "fold setup into the task whose deliverable needs it" rule. It's verified by Task 5's manual check.

- [ ] **Step 1: Update imports and state shape**

In `src/lib/store.ts`:

Change:
```ts
import type { WorkoutLog } from "@/lib/log-schemas";
import {
  getFirstUser,
  getLatestAssessmentForUser,
  getLatestCheckInForUser,
  getWorkoutLogsForUser,
  seedExercisesIfEmpty,
  seedPersonalDataIfEmpty,
} from "@/lib/db";
```
to:
```ts
import type { BenchmarkLog, WorkoutLog } from "@/lib/log-schemas";
import {
  getBenchmarkLogsForUser,
  getFirstUser,
  getLatestAssessmentForUser,
  getLatestCheckInForUser,
  getWorkoutLogsForUser,
  seedExercisesIfEmpty,
  seedPersonalDataIfEmpty,
} from "@/lib/db";
```

Change the `AppState` interface — add after `workoutLogs: WorkoutLog[];`:
```ts
  benchmarkLogs: BenchmarkLog[];
```
and after `refreshLogs: () => Promise<void>;`:
```ts
  refreshBenchmarks: () => Promise<void>;
```

- [ ] **Step 2: Update `create<AppState>` implementation**

Change the initial state — add after `workoutLogs: [],`:
```ts
  benchmarkLogs: [],
```

Change `hydrate` to also load benchmark logs:
```ts
  hydrate: async () => {
    await seedExercisesIfEmpty();
    await seedPersonalDataIfEmpty();
    const user = (await getFirstUser()) ?? null;
    const [latestAssessment, latestCheckIn, workoutLogs, benchmarkLogs] = user
      ? await Promise.all([
          getLatestAssessmentForUser(user.id),
          getLatestCheckInForUser(user.id),
          getWorkoutLogsForUser(user.id),
          getBenchmarkLogsForUser(user.id),
        ])
      : [undefined, undefined, [], []];
    set({
      user,
      latestAssessment: latestAssessment ?? null,
      latestCheckIn: latestCheckIn ?? null,
      workoutLogs: workoutLogs ?? [],
      benchmarkLogs: benchmarkLogs ?? [],
      hydrated: true,
    });
  },
```

Add a new action after `refreshLogs`:
```ts
  refreshBenchmarks: async () => {
    const { user } = get();
    if (!user) return;
    const benchmarkLogs = await getBenchmarkLogsForUser(user.id);
    set({ benchmarkLogs });
  },
```

- [ ] **Step 3: Run the full test suite (no new tests, but confirm nothing broke)**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat: load benchmark logs into app store"
```

---

### Task 5: Plank benchmark card on the Progress page

**Files:**
- Modify: `src/app/progress/page.tsx`

**Interfaces:**
- Consumes: `useAppStore().benchmarkLogs` / `refreshBenchmarks` (Task 4), `latestBenchmark`/`personalBest`/`benchmarkTrend` (Task 3), `putBenchmarkLog` (Task 2), `NewBenchmarkLogInput`/`BenchmarkLog` (Task 1), `Sparkline` (`@/components/ui/sparkline`), `Card`/`CardTitle` (`@/components/ui/card`), `Label` (`@/components/ui/label`), `Input` (`@/components/ui/input`), `Button` (`@/components/ui/button`).

This is a UI task with no automated test (no component test infra exists in this repo per the M11-A precedent — `docs/superpowers/specs/2026-07-13-m11a-equipment-tag-fix-design.md` chose pure functions over component tests for the same reason). Verify manually via dev server per Step 3.

- [ ] **Step 1: Add imports and local state**

In `src/app/progress/page.tsx`, update imports:

```ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { getPainLogsForUser, putBenchmarkLog } from "@/lib/db";
import {
  computeStreak,
  sessionsInLastDays,
  painTrend,
  latestBenchmark,
  personalBest,
  benchmarkTrend,
} from "@/lib/progress";
import type { PainLog, BenchmarkLog } from "@/lib/log-schemas";
```

Inside `ProgressPage`, after the existing `useState<PainLog[]>` line, add:

```ts
  const { hydrated, hydrate, user, workoutLogs, benchmarkLogs, refreshBenchmarks } = useAppStore();
```

(replacing the existing destructure of `useAppStore` which currently omits `benchmarkLogs`/`refreshBenchmarks` — merge into one destructure, don't duplicate the call.)

Add local state for the entry form, alongside the existing `painLogs` state:

```ts
  const [plankSeconds, setPlankSeconds] = useState("");
  const [savingPlank, setSavingPlank] = useState(false);
```

- [ ] **Step 2: Add derived values and the save handler**

After the existing `trend` memo, add:

```ts
  const plankLatest = useMemo(
    () => latestBenchmark(benchmarkLogs, "plank_hold"),
    [benchmarkLogs]
  );
  const plankBest = useMemo(
    () => personalBest(benchmarkLogs, "plank_hold"),
    [benchmarkLogs]
  );
  const plankTrend = useMemo(
    () => benchmarkTrend(benchmarkLogs, "plank_hold"),
    [benchmarkLogs]
  );
  const plankTrendMax = useMemo(
    () => Math.max(60, ...plankTrend.map((p) => p.value)),
    [plankTrend]
  );

  async function onSavePlank() {
    if (!user) return;
    const seconds = Number(plankSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    setSavingPlank(true);
    const log: BenchmarkLog = {
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: Date.now(),
      type: "plank_hold",
      value: seconds,
    };
    await putBenchmarkLog(log);
    await refreshBenchmarks();
    setPlankSeconds("");
    setSavingPlank(false);
  }
```

- [ ] **Step 3: Add the card to the JSX**

Insert a new `<Card>` after the existing "Tren nyeri" card and before the `<section>` for "Sesi terakhir":

```tsx
        <Card>
          <CardTitle>Tes plank</CardTitle>
          {plankLatest === null ? (
            <p className="text-sm text-muted-foreground">
              Belum ada tes plank tercatat.
            </p>
          ) : (
            <div className="flex items-baseline gap-3">
              <p className="tabular font-display text-3xl text-primary-deep">
                {plankLatest}
                <span className="ml-1 text-sm font-sans text-muted-foreground">
                  detik
                </span>
              </p>
              {plankBest !== null && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                  PB {plankBest}s
                </span>
              )}
            </div>
          )}
          {plankTrend.length > 0 && (
            <div className="mt-2">
              <Sparkline
                values={plankTrend.map((p) => p.value)}
                max={plankTrendMax}
              />
            </div>
          )}
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="plank-seconds">Catat tes (detik)</Label>
              <Input
                id="plank-seconds"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="mis. 45"
                value={plankSeconds}
                onChange={(e) => setPlankSeconds(e.target.value)}
              />
            </div>
            <Button onClick={onSavePlank} disabled={savingPlank || !user || !plankSeconds}>
              {savingPlank ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </Card>
```

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 5: Manual verification via dev server**

Run: `npm run dev`, open the Progress page in a browser.
Expected:
- "Tes plank" card renders with empty state ("Belum ada tes plank tercatat.") before any entry.
- Entering a number (e.g. `45`) and clicking "Simpan" saves the log, clears the input, and immediately shows "45 detik" with a "PB 45s" badge.
- Entering a second, smaller value (e.g. `30`) updates the latest display to 30s but keeps "PB 45s".
- Entering a larger value (e.g. `60`) updates both latest and PB to 60s, and the sparkline shows all three points.
- Reloading the page preserves the logged values (persisted in IndexedDB).

- [ ] **Step 6: Commit**

```bash
git add src/app/progress/page.tsx
git commit -m "feat: add plank benchmark card to Progress page"
```

---

## Self-Review Notes

- **Spec coverage:** schema (Task 1) ✓, storage (Task 2) ✓, store (Task 4) ✓, pure calcs (Task 3) ✓, UI (Task 5) ✓, testing (Tasks 1-3 TDD, Task 5 manual per M11-A precedent) ✓. Out-of-scope items (push-up/dead-hang, live timer, Supabase sync) correctly excluded from all tasks.
- **Placeholder scan:** none — every step has literal code or an exact command with expected output.
- **Type consistency:** `BenchmarkLog`/`BenchmarkType` (Task 1) used identically in Tasks 2, 3, 4, 5. `latestBenchmark`/`personalBest`/`benchmarkTrend` signatures (Task 3) match their call sites in Task 5. `putBenchmarkLog`/`getBenchmarkLogsForUser` (Task 2) match usage in Tasks 4-5.
