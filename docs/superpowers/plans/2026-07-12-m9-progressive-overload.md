# M9 Progressive Overload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-move duration progression (derived from workout logs) that lengthens holds as a user completes a move cleanly, then swaps to its `progressionId` at ceiling when readiness is full.

**Architecture:** Pure additions to `src/lib/decision-engine.ts` — two exported helper functions plus an overload pass inside `generateSession`. No schema change, no new store; progression state is derived from existing `workoutLogs`. The seed is never mutated (exercises are cloned with a new `durationSeconds`).

**Tech Stack:** TypeScript, Vitest, Zod schemas (existing). No new dependencies.

## Global Constraints

- Engine stays pure, deterministic, no network/model call.
- Never targets a specific curve; never estimates Cobb.
- Safety/recovery wins over performance; corrective work never zero.
- No new schema fields, no IndexedDB migration, no new store.
- "Clean" for a move = log contains that `exerciseId` with `completed === true` AND `(log.postSessionPain ?? 0) <= 3`.
- Progression parameters (moderate): +15s per 2 clean sessions, ceiling +45s.
- Swap to `progressionId` only when `intensity === "full"`.
- Reasoning lines in Bahasa Indonesia.
- `workoutLogs` are newest-first.

---

### Task 1: `countCleanStreak` helper

**Files:**
- Modify: `src/lib/decision-engine.ts` (add exported function near `deriveCapability`)
- Test: `src/lib/__tests__/decision-engine.test.ts` (new `describe` block)

**Interfaces:**
- Consumes: `WorkoutLog` from `@/lib/log-schemas` (already imported in the test).
- Produces: `countCleanStreak(exerciseId: string, logs: WorkoutLog[]): number` — counts the leading run of clean sessions for the move, newest-first; sessions where the move is absent are skipped (neither counted nor breaking); a present-but-unclean session breaks the run.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/__tests__/decision-engine.test.ts`. First add `countCleanStreak` to the import from `@/lib/decision-engine`, then append:

```ts
function wlog(
  exercises: { exerciseId: string; completed: boolean }[],
  postSessionPain = 0
): WorkoutLog {
  return {
    id: `w-${Math.random()}`,
    userId: "u1",
    createdAt: 0,
    movementFocus: "x",
    intensity: "full",
    estimatedMinutes: 10,
    exercises: exercises.map((e) => ({
      exerciseId: e.exerciseId,
      name: e.exerciseId,
      domain: "core" as const,
      completed: e.completed,
    })),
    postSessionPain,
  };
}

describe("countCleanStreak", () => {
  it("counts a clean run, newest-first", () => {
    const logs = [
      wlog([{ exerciseId: "ex-dead-bug", completed: true }]),
      wlog([{ exerciseId: "ex-dead-bug", completed: true }]),
    ];
    expect(countCleanStreak("ex-dead-bug", logs)).toBe(2);
  });

  it("skips sessions where the move is absent", () => {
    const logs = [
      wlog([{ exerciseId: "ex-dead-bug", completed: true }]),
      wlog([{ exerciseId: "ex-cat-cow", completed: true }]), // absent → skipped
      wlog([{ exerciseId: "ex-dead-bug", completed: true }]),
    ];
    expect(countCleanStreak("ex-dead-bug", logs)).toBe(2);
  });

  it("breaks on a present-but-incomplete session", () => {
    const logs = [
      wlog([{ exerciseId: "ex-dead-bug", completed: true }]),
      wlog([{ exerciseId: "ex-dead-bug", completed: false }]),
      wlog([{ exerciseId: "ex-dead-bug", completed: true }]),
    ];
    expect(countCleanStreak("ex-dead-bug", logs)).toBe(1);
  });

  it("breaks when post-session pain exceeds 3", () => {
    const logs = [
      wlog([{ exerciseId: "ex-dead-bug", completed: true }], 5),
      wlog([{ exerciseId: "ex-dead-bug", completed: true }]),
    ];
    expect(countCleanStreak("ex-dead-bug", logs)).toBe(0);
  });

  it("returns 0 for a never-logged move", () => {
    expect(countCleanStreak("ex-dead-bug", [])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t countCleanStreak`
Expected: FAIL — `countCleanStreak is not a function` / import error.

- [ ] **Step 3: Write the minimal implementation**

Add to `src/lib/decision-engine.ts` after `deriveCapability`:

```ts
/**
 * Count the leading run of clean sessions for one move (newest-first).
 * A session where the move is absent is skipped — not counted, not breaking —
 * because low-intensity or short days legitimately drop moves. A session where
 * the move is present but not clean (incomplete, or postSessionPain > 3) ends
 * the run. Source of per-move progression state — no new store (M9).
 */
export function countCleanStreak(
  exerciseId: string,
  logs: WorkoutLog[]
): number {
  let streak = 0;
  for (const log of logs) {
    const entry = log.exercises.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue; // move absent → skip
    const clean = entry.completed && (log.postSessionPain ?? 0) <= 3;
    if (!clean) break;
    streak += 1;
  }
  return streak;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t countCleanStreak`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: add countCleanStreak for per-move progression (M9)"
```

---

### Task 2: `progressedDuration` helper

**Files:**
- Modify: `src/lib/decision-engine.ts` (add exported function after `countCleanStreak`)
- Test: `src/lib/__tests__/decision-engine.test.ts` (new `describe` block)

**Interfaces:**
- Consumes: nothing new.
- Produces: `progressedDuration(base: number, streak: number): number` — returns `base + min(15 * floor(streak/2), 45)`.

- [ ] **Step 1: Write the failing tests**

Add `progressedDuration` to the import, then append:

```ts
describe("progressedDuration", () => {
  it("holds at base below 2 clean sessions", () => {
    expect(progressedDuration(60, 0)).toBe(60);
    expect(progressedDuration(60, 1)).toBe(60);
  });

  it("adds 15s per 2 clean sessions", () => {
    expect(progressedDuration(60, 2)).toBe(75);
    expect(progressedDuration(60, 4)).toBe(90);
  });

  it("caps at +45s", () => {
    expect(progressedDuration(60, 6)).toBe(105);
    expect(progressedDuration(60, 20)).toBe(105);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t progressedDuration`
Expected: FAIL — `progressedDuration is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Add to `src/lib/decision-engine.ts` after `countCleanStreak`:

```ts
/** Duration ceiling added by progression (M9, moderate cadence). */
const PROGRESS_STEP_SECONDS = 15;
const PROGRESS_CAP_SECONDS = 45;
const PROGRESS_STREAK_AT_CAP = 6; // 3 steps × 2 clean sessions each

/**
 * Prescribed hold for a move given its clean streak: +15s per 2 clean
 * sessions, capped at +45s over the seed base. Deterministic; the seed
 * duration is never mutated (caller clones).
 */
export function progressedDuration(base: number, streak: number): number {
  const bump = Math.min(
    PROGRESS_STEP_SECONDS * Math.floor(streak / 2),
    PROGRESS_CAP_SECONDS
  );
  return base + bump;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t progressedDuration`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: add progressedDuration step/cap helper (M9)"
```

---

### Task 3: Duration-bump overload pass in `generateSession`

**Files:**
- Modify: `src/lib/decision-engine.ts` (`generateSession`, the per-step fitting loop ~lines 324-363, and reasoning section)
- Test: `src/lib/__tests__/decision-engine.test.ts` (new `describe` block)

**Interfaces:**
- Consumes: `countCleanStreak`, `progressedDuration` (Tasks 1-2).
- Produces: `generateSession` now clones each picked exercise (except recovery intensity) with `durationSeconds = progressedDuration(base, streak)`, and pushes the reasoning line `"Sebagian gerakan naik durasi — kamu konsisten menyelesaikannya."` when at least one move was bumped.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/decision-engine.test.ts`. Reuse the `wlog` helper from Task 1 (place these `describe` blocks after it):

```ts
describe("generateSession — M9 duration overload", () => {
  const twoCleanDeadBug = [
    wlog([{ exerciseId: "ex-dead-bug", completed: true }]),
    wlog([{ exerciseId: "ex-dead-bug", completed: true }]),
  ];

  it("bumps a move's duration after 2 clean sessions", () => {
    const s = generateSession(
      inputs({
        checkIn: checkIn({ painLevel: 1, recovery: 5, energyLevel: 5, sleepQuality: 5 }),
        workoutLogs: twoCleanDeadBug,
      })
    );
    const dead = s.blocks
      .flatMap((b) => b.exercises)
      .find((e) => e.id === "ex-dead-bug");
    expect(dead?.durationSeconds).toBe(75); // seed base 60 + 15
  });

  it("adds a reasoning line when a move is bumped", () => {
    const s = generateSession(
      inputs({
        checkIn: checkIn({ painLevel: 1, recovery: 5, energyLevel: 5, sleepQuality: 5 }),
        workoutLogs: twoCleanDeadBug,
      })
    );
    expect(s.reasoning.some((r) => r.includes("naik durasi"))).toBe(true);
  });

  it("does not mutate the seed exercise", () => {
    generateSession(
      inputs({
        checkIn: checkIn({ painLevel: 1, recovery: 5, energyLevel: 5, sleepQuality: 5 }),
        workoutLogs: twoCleanDeadBug,
      })
    );
    const seed = EXERCISE_SEED.find((e) => e.id === "ex-dead-bug");
    expect(seed?.durationSeconds).toBe(60);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "M9 duration overload"`
Expected: FAIL — `dead?.durationSeconds` is 60, not 75.

- [ ] **Step 3: Write the minimal implementation**

In `src/lib/decision-engine.ts`, inside `generateSession`, replace the fitting loop body. Locate the block that currently reads:

```ts
    const fitted: Exercise[] = [];
    for (const ex of picks) {
      if (usedSeconds + ex.durationSeconds > budgetSeconds && blocks.length > 0) {
        break;
      }
      fitted.push(ex);
      usedSeconds += ex.durationSeconds;
    }
```

Replace it with an overload transform before fitting (swap is added in Task 4; here only the duration bump). Also declare a `bumped` flag once, above the `for (const step of sequence)` loop:

```ts
  let bumped = false;
```

Then the loop body:

```ts
    // M9 overload: lengthen holds a move has earned (recovery ignores duration).
    const transformed: Exercise[] =
      intensity === "recovery"
        ? picks
        : picks.map((ex) => {
            const streak = countCleanStreak(ex.id, inputs.workoutLogs ?? []);
            const dur = progressedDuration(ex.durationSeconds, streak);
            if (dur !== ex.durationSeconds) bumped = true;
            return dur === ex.durationSeconds ? ex : { ...ex, durationSeconds: dur };
          });

    const fitted: Exercise[] = [];
    for (const ex of transformed) {
      if (usedSeconds + ex.durationSeconds > budgetSeconds && blocks.length > 0) {
        break;
      }
      fitted.push(ex);
      usedSeconds += ex.durationSeconds;
    }
```

Then, in the reasoning section (after the fitting loop, near the other `reasoning.push` calls), add:

```ts
  if (bumped) {
    reasoning.push(
      "Sebagian gerakan naik durasi — kamu konsisten menyelesaikannya."
    );
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "M9 duration overload"`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full engine suite (no regressions)**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: apply earned per-move duration overload to sessions (M9)"
```

---

### Task 4: Progression swap at ceiling, gated to full intensity

**Files:**
- Modify: `src/lib/decision-engine.ts` (`generateSession` overload transform + reasoning)
- Test: `src/lib/__tests__/decision-engine.test.ts` (new `describe` block)

**Interfaces:**
- Consumes: `countCleanStreak`, `progressedDuration`, `PROGRESS_STREAK_AT_CAP`, the `exercises` pool, and `allowedEquipment` (already built in `generateSession`).
- Produces: when a move's streak ≥ cap AND `intensity === "full"` AND `progressionId` resolves to an available, equipment-allowed exercise in the pool, the emitted block contains the progression move (at its own base duration) instead of the original, and a reasoning line `"<old> → <new>: sudah mantap, naik ke variasi lebih menantang."` is pushed.

- [ ] **Step 1: Write the failing tests**

Append:

```ts
describe("generateSession — M9 progression swap", () => {
  const sixClean = Array.from({ length: 6 }, () =>
    wlog([{ exerciseId: "ex-dead-bug", completed: true }])
  );
  const fullReady = checkIn({
    painLevel: 1,
    recovery: 5,
    energyLevel: 5,
    sleepQuality: 5,
  });

  it("swaps a capped move to its progression when intensity is full", () => {
    const s = generateSession(inputs({ checkIn: fullReady, workoutLogs: sixClean }));
    const ids = s.blocks.flatMap((b) => b.exercises).map((e) => e.id);
    expect(ids).toContain("ex-bird-dog");
    expect(ids).not.toContain("ex-dead-bug");
  });

  it("adds a swap reasoning line", () => {
    const s = generateSession(inputs({ checkIn: fullReady, workoutLogs: sixClean }));
    expect(s.reasoning.some((r) => r.includes("naik ke variasi lebih menantang"))).toBe(
      true
    );
  });

  it("does NOT swap when intensity is not full", () => {
    // painLevel 3 → moderate, not full
    const s = generateSession(
      inputs({ checkIn: checkIn({ painLevel: 3 }), workoutLogs: sixClean })
    );
    const ids = s.blocks.flatMap((b) => b.exercises).map((e) => e.id);
    expect(ids).toContain("ex-dead-bug");
    expect(ids).not.toContain("ex-bird-dog");
  });

  it("does NOT swap a move whose progressionId is null", () => {
    // ex-90-90-breathing is a terminal move (progressionId: null); even at cap
    // + full it must stay put (only its duration may bump).
    const sixClean9090 = Array.from({ length: 6 }, () =>
      wlog([{ exerciseId: "ex-90-90-breathing", completed: true }])
    );
    const s = generateSession(inputs({ checkIn: fullReady, workoutLogs: sixClean9090 }));
    const ids = s.blocks.flatMap((b) => b.exercises).map((e) => e.id);
    expect(ids).toContain("ex-90-90-breathing");
    expect(s.reasoning.some((r) => r.includes("naik ke variasi lebih menantang"))).toBe(
      false
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "M9 progression swap"`
Expected: FAIL — capped move still `ex-dead-bug`, no swap.

- [ ] **Step 3: Write the minimal implementation**

In `src/lib/decision-engine.ts`, extend the `transformed` map from Task 3 to try a swap first, then fall back to the duration bump. Declare a `swaps` array once, above the sequence loop (next to `let bumped = false;`):

```ts
  const swaps: { from: string; to: string }[] = [];
```

Replace the Task 3 `transformed` map with:

```ts
    const transformed: Exercise[] =
      intensity === "recovery"
        ? picks
        : picks.map((ex) => {
            const streak = countCleanStreak(ex.id, inputs.workoutLogs ?? []);
            // Ceiling + full readiness → offer the progression move.
            if (streak >= PROGRESS_STREAK_AT_CAP && intensity === "full" && ex.progressionId) {
              const next = exercises.find((e) => e.id === ex.progressionId);
              const available =
                next !== undefined &&
                next.equipment.every((item) => allowedEquipment.has(item));
              if (available) {
                swaps.push({ from: ex.name, to: next.name });
                return next; // its own base duration; its streak starts fresh
              }
            }
            const dur = progressedDuration(ex.durationSeconds, streak);
            if (dur !== ex.durationSeconds) bumped = true;
            return dur === ex.durationSeconds ? ex : { ...ex, durationSeconds: dur };
          });
```

In the reasoning section, after the `bumped` line, add:

```ts
  for (const s of swaps) {
    reasoning.push(`${s.from} → ${s.to}: sudah mantap, naik ke variasi lebih menantang.`);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "M9 progression swap"`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full test suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: swap capped moves to progression at full intensity (M9)"
```

---

## Notes for the implementer

- `EXERCISE_SEED` and the `inputs`/`checkIn`/`wlog` test helpers already exist (or are added in Task 1). Do not redefine them.
- The overload transform must run BEFORE the budget-fitting loop so longer holds and swapped moves count against `availableMinutes`.
- Keep the seed immutable — always clone (`{ ...ex, durationSeconds }`); never assign to `ex.durationSeconds`.
- The equipment-gate branch of the swap (`next.equipment.every(...)`) is not integration-tested: the whole pull-up chain requires a bar for the move itself, so a bodyweight-move → geared-progression pair does not exist in the seed. The branch is still implemented for correctness (and for future seed moves); the `progressionId: null` test plus the not-full test cover the observable swap guards.
- Seed pull-up chain ids for reference: `ex-dead-hang` → `ex-scapular-pull` → `ex-negative-pullup` → `ex-full-pullup` (note: `pullup`, no hyphen).
