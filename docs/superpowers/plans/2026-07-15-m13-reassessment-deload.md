# M13 — Weekly Reassessment + Deload Berkala Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weekly self-report (reassessment) that biases the engine's goal weights, and an automatic 4-week deload cap on session intensity — both additive, optional, and backward-compatible with the existing pure `decision-engine.ts`.

**Architecture:** New `reassessmentLogs` IndexedDB store (mirrors `benchmarkLogs`) feeds an optional `latestReassessment` into `deriveGoalWeights`. A new pure `shouldDeload`/`applyDeloadCap` pair, driven purely by `workoutLogs`, caps `generateSession`'s final intensity. A new `/reassess` route collects the self-report; a banner on `/workout` prompts it every ≥7 days.

**Tech Stack:** Next.js App Router, Zustand (`src/lib/store.ts`), Zod schemas, `idb` (IndexedDB), Vitest.

## Global Constraints

- Engine stays pure/deterministic — no network, no model call.
- Never targets a curve, never estimates a Cobb angle.
- Safety/recovery always wins: deload cap only lowers `full`/`moderate` → `light`; never touches `recovery`.
- New fields are optional with no data migration required for existing records.
- No behavior change when `latestReassessment` is absent — `deriveGoalWeights(assessment)` (no second arg) must produce byte-identical output to before this plan.

---

### Task 1: Reassessment schema

**Files:**
- Modify: `src/lib/log-schemas.ts`
- Test: `src/lib/__tests__/log-schemas.test.ts` (create if it doesn't exist — check first with Glob; if a schema test file already exists for a sibling schema like `benchmarkLogSchema`, add to it instead)

**Interfaces:**
- Produces: `reassessmentLogSchema`, `ReassessmentLog` type, `newReassessmentLogInputSchema`, `NewReassessmentLogInput` type — all consumed by Task 2 (db.ts) and Task 5 (engine).

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/log-schemas.test.ts` (or append if it exists — run `Glob` for `src/lib/__tests__/log-schemas.test.ts` first):

```ts
import { describe, expect, it } from "vitest";
import { reassessmentLogSchema, newReassessmentLogInputSchema } from "@/lib/log-schemas";

describe("reassessmentLogSchema", () => {
  it("accepts a full valid log", () => {
    const result = reassessmentLogSchema.safeParse({
      id: "r1",
      userId: "u1",
      createdAt: 1000,
      flexibility: 3,
      balance: 4,
      breathingQuality: 5,
      painAreas: "leher",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a log without optional painAreas", () => {
    const result = reassessmentLogSchema.safeParse({
      id: "r1",
      userId: "u1",
      createdAt: 1000,
      flexibility: 1,
      balance: 1,
      breathingQuality: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a score outside 1..5", () => {
    const result = reassessmentLogSchema.safeParse({
      id: "r1",
      userId: "u1",
      createdAt: 1000,
      flexibility: 6,
      balance: 3,
      breathingQuality: 3,
    });
    expect(result.success).toBe(false);
  });

  it("newReassessmentLogInputSchema omits id and createdAt", () => {
    const result = newReassessmentLogInputSchema.safeParse({
      userId: "u1",
      flexibility: 2,
      balance: 2,
      breathingQuality: 2,
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/log-schemas.test.ts`
Expected: FAIL with "reassessmentLogSchema is not exported" (or module has no export).

- [ ] **Step 3: Add the schema**

In `src/lib/log-schemas.ts`, append after `newBenchmarkLogInputSchema` (end of file):

```ts
export const reassessmentLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  flexibility: z.number().int().min(1).max(5),
  balance: z.number().int().min(1).max(5),
  breathingQuality: z.number().int().min(1).max(5),
  painAreas: z.string().max(300).optional(),
});
export type ReassessmentLog = z.infer<typeof reassessmentLogSchema>;

export const newReassessmentLogInputSchema = reassessmentLogSchema.omit({
  id: true,
  createdAt: true,
});
export type NewReassessmentLogInput = z.infer<
  typeof newReassessmentLogInputSchema
>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/log-schemas.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/log-schemas.ts src/lib/__tests__/log-schemas.test.ts
git commit -m "feat(m13): add reassessmentLog schema"
```

---

### Task 2: IndexedDB store + read/write helpers

**Files:**
- Modify: `src/lib/db.ts`

**Interfaces:**
- Consumes: `ReassessmentLog` type from Task 1 (`src/lib/log-schemas.ts`).
- Produces: `putReassessmentLog(log: ReassessmentLog): Promise<void>`, `getReassessmentLogsForUser(userId: string): Promise<ReassessmentLog[]>` (newest first), `getLatestReassessmentForUser(userId: string): Promise<ReassessmentLog | undefined>` — consumed by Task 3 (store.ts) and Task 6 (UI).

No dedicated unit test file exists for `db.ts` (it's exercised indirectly via the app in browser/manual testing per existing project convention — confirm by running `Glob` for `src/lib/__tests__/db.test.ts`; if none exists, skip a test step here and verify via `npx tsc --noEmit` instead).

- [ ] **Step 1: Bump DB_VERSION and declare the store**

In `src/lib/db.ts`:

Change line 4 import:
```ts
import type { BenchmarkLog, PainLog, ReassessmentLog, WorkoutLog } from "@/lib/log-schemas";
```

Change line 16:
```ts
const DB_VERSION = 6;
```

Add to the `SpineCoachDB` interface, after the `benchmarkLogs` entry (currently lines 43-47):
```ts
  reassessmentLogs: {
    key: string;
    value: ReassessmentLog;
    indexes: { "by-userId": string };
  };
```

- [ ] **Step 2: Add the upgrade branch**

After the `if (oldVersion < 5) { ... }` block (currently lines 97-102), add:
```ts
        if (oldVersion < 6) {
          const reassessmentLogs = db.createObjectStore("reassessmentLogs", {
            keyPath: "id",
          });
          reassessmentLogs.createIndex("by-userId", "userId");
        }
```

- [ ] **Step 3: Add read/write helpers**

After `getBenchmarkLogsForUser` (currently ends at line 250), add:
```ts
export async function putReassessmentLog(log: ReassessmentLog): Promise<void> {
  const db = await getDB();
  await db.put("reassessmentLogs", log);
}

/** Reassessment logs for a user, newest first. */
export async function getReassessmentLogsForUser(
  userId: string
): Promise<ReassessmentLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(
    "reassessmentLogs",
    "by-userId",
    userId
  );
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getLatestReassessmentForUser(
  userId: string
): Promise<ReassessmentLog | undefined> {
  const all = await getReassessmentLogsForUser(userId);
  return all[0];
}
```

- [ ] **Step 4: Add the store to `resetUserData`'s store list**

In `resetUserData` (currently lines 273-292), add `"reassessmentLogs"` to the `stores` array, after `"benchmarkLogs"`:
```ts
  const stores = [
    "users",
    "assessments",
    "checkIns",
    "goals",
    "workoutPlans",
    "workoutLogs",
    "painLogs",
    "benchmarkLogs",
    "reassessmentLogs",
    "recoveryLogs",
    "photos",
    "medicalRecords",
    "reports",
  ] as const;
```

- [ ] **Step 5: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(m13): add reassessmentLogs IndexedDB store (DB_VERSION 6)"
```

---

### Task 3: Wire reassessment into the app store

**Files:**
- Modify: `src/lib/store.ts`

**Interfaces:**
- Consumes: `getReassessmentLogsForUser`, `getLatestReassessmentForUser` from Task 2 (`src/lib/db.ts`); `ReassessmentLog` type from Task 1.
- Produces: `useAppStore().latestReassessment: ReassessmentLog | null`, `useAppStore().refreshReassessment(): Promise<void>` — consumed by Task 5 (engine call site) and Task 6/7 (UI).

No dedicated test file exists for `store.ts` (Zustand store wired to IndexedDB — verified via browser in Task 8, not unit tests). Skip TDD steps; verify via typecheck.

- [ ] **Step 1: Extend imports and state shape**

In `src/lib/store.ts`, change the import block (lines 4-13):
```ts
import type { BenchmarkLog, ReassessmentLog, WorkoutLog } from "@/lib/log-schemas";
import {
  getBenchmarkLogsForUser,
  getFirstUser,
  getLatestAssessmentForUser,
  getLatestCheckInForUser,
  getLatestReassessmentForUser,
  getWorkoutLogsForUser,
  seedExercisesIfEmpty,
  seedPersonalDataIfEmpty,
} from "@/lib/db";
```

Extend the `AppState` interface (lines 15-28):
```ts
interface AppState {
  hydrated: boolean;
  user: User | null;
  latestAssessment: Assessment | null;
  latestCheckIn: CheckIn | null;
  workoutLogs: WorkoutLog[];
  benchmarkLogs: BenchmarkLog[];
  latestReassessment: ReassessmentLog | null;
  hydrate: () => Promise<void>;
  refreshLogs: () => Promise<void>;
  refreshBenchmarks: () => Promise<void>;
  refreshReassessment: () => Promise<void>;
  setUser: (user: User) => void;
  setLatestAssessment: (assessment: Assessment) => void;
  setLatestCheckIn: (checkIn: CheckIn) => void;
}
```

- [ ] **Step 2: Wire hydrate() and add refreshReassessment()**

Replace the `hydrate` function body (lines 38-58):
```ts
  hydrate: async () => {
    await seedExercisesIfEmpty();
    await seedPersonalDataIfEmpty();
    const user = (await getFirstUser()) ?? null;
    const [latestAssessment, latestCheckIn, workoutLogs, benchmarkLogs, latestReassessment] =
      user
        ? await Promise.all([
            getLatestAssessmentForUser(user.id),
            getLatestCheckInForUser(user.id),
            getWorkoutLogsForUser(user.id),
            getBenchmarkLogsForUser(user.id),
            getLatestReassessmentForUser(user.id),
          ])
        : [undefined, undefined, [], [], undefined];
    set({
      user,
      latestAssessment: latestAssessment ?? null,
      latestCheckIn: latestCheckIn ?? null,
      workoutLogs: workoutLogs ?? [],
      benchmarkLogs: benchmarkLogs ?? [],
      latestReassessment: latestReassessment ?? null,
      hydrated: true,
    });
  },
```

Add after `refreshBenchmarks` (currently ends line 72), before `setUser`:
```ts
  refreshReassessment: async () => {
    const { user } = get();
    if (!user) return;
    const latestReassessment = (await getLatestReassessmentForUser(user.id)) ?? null;
    set({ latestReassessment });
  },
```

Also add `latestReassessment: null,` to the initial state object (near line 36, alongside `benchmarkLogs: [],`).

- [ ] **Step 2b: Verify with typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat(m13): load latest reassessment into app store"
```

---

### Task 4: `deriveGoalWeights` reassessment modifier

**Files:**
- Modify: `src/lib/decision-engine.ts`
- Test: `src/lib/__tests__/decision-engine.test.ts`

**Interfaces:**
- Consumes: `ReassessmentLog` type from Task 1.
- Produces: `deriveGoalWeights(assessment: Assessment, latestReassessment?: ReassessmentLog): GoalWeights` (signature change, second param optional) — consumed by Task 5's `generateSession` wiring.

Mapping decision (locked in during design): `flexibility` maps to the existing `mobility` category (direct match). `balance` and `breathingQuality` have no dedicated `GoalWeights` category — but `posture` is the weight that already gates extra slots for the `stability` and `breathing` domains in `generateSession` (see `boosted` check). Low balance or low breathing quality bump `posture`, reusing that existing lever instead of inventing a new category.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/__tests__/decision-engine.test.ts`, inside the existing `describe("deriveGoalWeights", ...)` block (after the last `it`, before its closing `});` at line 157):

```ts
  it("is unaffected when no reassessment is passed (backward compatible)", () => {
    const withoutArg = deriveGoalWeights(baseAssessment);
    const withUndefined = deriveGoalWeights(baseAssessment, undefined);
    expect(withoutArg).toEqual(withUndefined);
  });

  it("bumps mobility when flexibility is low", () => {
    const base = deriveGoalWeights(baseAssessment);
    const withLowFlex = deriveGoalWeights(baseAssessment, {
      id: "r1",
      userId: "u1",
      createdAt: 0,
      flexibility: 2,
      balance: 4,
      breathingQuality: 4,
    });
    expect(withLowFlex.mobility).toBeGreaterThan(base.mobility);
  });

  it("bumps posture when balance is low", () => {
    const base = deriveGoalWeights(baseAssessment);
    const withLowBalance = deriveGoalWeights(baseAssessment, {
      id: "r1",
      userId: "u1",
      createdAt: 0,
      flexibility: 4,
      balance: 1,
      breathingQuality: 4,
    });
    expect(withLowBalance.posture).toBeGreaterThan(base.posture);
  });

  it("bumps posture when breathing quality is low", () => {
    const base = deriveGoalWeights(baseAssessment);
    const withLowBreath = deriveGoalWeights(baseAssessment, {
      id: "r1",
      userId: "u1",
      createdAt: 0,
      flexibility: 4,
      balance: 4,
      breathingQuality: 2,
    });
    expect(withLowBreath.posture).toBeGreaterThan(base.posture);
  });

  it("does not bump anything when all reassessment scores are healthy", () => {
    const base = deriveGoalWeights(baseAssessment);
    const withHealthy = deriveGoalWeights(baseAssessment, {
      id: "r1",
      userId: "u1",
      createdAt: 0,
      flexibility: 4,
      balance: 4,
      breathingQuality: 4,
    });
    expect(withHealthy).toEqual(base);
  });
```

Also add the import at the top of the test file (line 17 area):
```ts
import type { ReassessmentLog, WorkoutLog } from "@/lib/log-schemas";
```
(replacing the existing `import type { WorkoutLog } from "@/lib/log-schemas";` line)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "deriveGoalWeights"`
Expected: FAIL — `deriveGoalWeights` currently only accepts one argument, TS/runtime will still call it but assertions on posture/mobility bump will fail (no modifier logic yet).

- [ ] **Step 3: Implement the modifier**

In `src/lib/decision-engine.ts`, replace `deriveGoalWeights` (currently lines 73-82):

```ts
/**
 * Derive focus weights from the free-text primaryGoals. Deterministic keyword
 * scan; when nothing matches, fall back to a balanced posture+strength default.
 * Weights bias per-domain slot counts, never add or remove safety domains.
 *
 * `latestReassessment` (M13, optional) adds a deterministic bump on top of
 * the keyword scan: low flexibility bumps mobility directly; low balance or
 * low breathing quality bump posture, since posture is the existing weight
 * that gates extra stability/breathing domain slots in generateSession.
 */
export function deriveGoalWeights(
  assessment: Assessment,
  latestReassessment?: ReassessmentLog
): GoalWeights {
  const text = (assessment.primaryGoals ?? "").toLowerCase();
  const weights: GoalWeights = { posture: 0, strength: 0, mobility: 0, pain: 0 };
  for (const key of Object.keys(GOAL_KEYWORDS) as (keyof GoalWeights)[]) {
    if (GOAL_KEYWORDS[key].some((kw) => text.includes(kw))) weights[key] = 1;
  }
  const anyMatch = Object.values(weights).some((v) => v > 0);
  const base = anyMatch
    ? weights
    : { posture: 1, strength: 1, mobility: 0, pain: 0 };

  if (!latestReassessment) return base;
  const result = { ...base };
  const REASSESSMENT_LOW = 2;
  if (latestReassessment.flexibility <= REASSESSMENT_LOW) result.mobility += 1;
  if (latestReassessment.balance <= REASSESSMENT_LOW) result.posture += 1;
  if (latestReassessment.breathingQuality <= REASSESSMENT_LOW) result.posture += 1;
  return result;
}
```

Add the import at the top of `src/lib/decision-engine.ts` (line 8 area):
```ts
import type { ReassessmentLog, WorkoutLog } from "@/lib/log-schemas";
```
(replacing the existing `import type { WorkoutLog } from "@/lib/log-schemas";` line)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "deriveGoalWeights"`
Expected: PASS (7 tests total in the describe block)

- [ ] **Step 5: Run the full decision-engine suite to confirm no regression**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts`
Expected: all existing tests still PASS (the two-arg call is additive; every other call site still passes one arg).

- [ ] **Step 6: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat(m13): reassessment modifier for deriveGoalWeights"
```

---

### Task 5: Deload detection + intensity cap

**Files:**
- Modify: `src/lib/decision-engine.ts`
- Test: `src/lib/__tests__/decision-engine.test.ts`

**Interfaces:**
- Consumes: `WorkoutLog[]` (existing type), `SessionIntensity` (existing type).
- Produces: `shouldDeload(workoutLogs: WorkoutLog[], now: number): boolean`, `applyDeloadCap(intensity: SessionIntensity, isDeloadWeek: boolean): SessionIntensity` — both exported for unit tests and consumed by `generateSession` in this same task's Step 5.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/__tests__/decision-engine.test.ts`, after the `describe("applyLoadSuppression", ...)` block (currently ends around line 737, before `describe("generateSession — M10 recovery load", ...)`):

```ts
describe("shouldDeload", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = 28 * DAY; // fixed reference so week windows land on clean boundaries

  function heavyLog(daysAgo: number, intensity: string): WorkoutLog {
    return {
      id: `w-${daysAgo}`,
      userId: "u1",
      createdAt: now - daysAgo * DAY,
      movementFocus: "x",
      intensity,
      estimatedMinutes: 30,
      exercises: [{ exerciseId: "e1", name: "e1", domain: "core", completed: true }],
      postSessionPain: 1,
    };
  }

  it("returns true when all 4 weeks average moderate or above", () => {
    const logs = [1, 8, 15, 22].map((d) => heavyLog(d, "full"));
    expect(shouldDeload(logs, now)).toBe(true);
  });

  it("returns false when one of the 4 weeks dips below moderate", () => {
    const logs = [heavyLog(1, "full"), heavyLog(8, "light"), heavyLog(15, "full"), heavyLog(22, "full")];
    expect(shouldDeload(logs, now)).toBe(false);
  });

  it("returns false when a week window has no sessions at all", () => {
    const logs = [heavyLog(1, "full"), heavyLog(15, "full"), heavyLog(22, "full")];
    expect(shouldDeload(logs, now)).toBe(false);
  });

  it("returns false with fewer than 28 days of history", () => {
    const logs = [heavyLog(1, "full"), heavyLog(8, "full")];
    expect(shouldDeload(logs, now)).toBe(false);
  });

  it("returns false with no logs", () => {
    expect(shouldDeload([], now)).toBe(false);
  });
});

describe("applyDeloadCap", () => {
  it("caps full to light during a deload week", () => {
    expect(applyDeloadCap("full", true)).toBe("light");
  });

  it("caps moderate to light during a deload week", () => {
    expect(applyDeloadCap("moderate", true)).toBe("light");
  });

  it("leaves light unchanged during a deload week", () => {
    expect(applyDeloadCap("light", true)).toBe("light");
  });

  it("leaves recovery unchanged during a deload week", () => {
    expect(applyDeloadCap("recovery", true)).toBe("recovery");
  });

  it("leaves intensity unchanged when not a deload week", () => {
    expect(applyDeloadCap("full", false)).toBe("full");
    expect(applyDeloadCap("moderate", false)).toBe("moderate");
  });
});
```

Add `shouldDeload` and `applyDeloadCap` to the import list at the top of the test file (alongside `applyLoadSuppression`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "shouldDeload"`
Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "applyDeloadCap"`
Expected: FAIL — both functions undefined/not exported.

- [ ] **Step 3: Implement `shouldDeload` and `applyDeloadCap`**

In `src/lib/decision-engine.ts`, add after `applyLoadSuppression` (currently ends at line 287):

```ts
/** Rolling weekly windows for deload detection: 4 consecutive 7-day blocks. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DELOAD_LOOKBACK_WEEKS = 4;
/** Weekly avg intensity weight at/above this counts as "consistently heavy". */
const DELOAD_INTENSITY_THRESHOLD = 0.75; // INTENSITY_WEIGHT.moderate

/**
 * True when the last 4 consecutive weeks each averaged moderate-or-above
 * intensity with at least one logged session — signals sustained heavy load
 * that warrants a preventive deload week, independent of any single day's
 * pain/recovery signal. A week with zero sessions never counts as "heavy",
 * so a new or inconsistent user is never flagged. Exported for unit testing.
 */
export function shouldDeload(workoutLogs: WorkoutLog[], now: number): boolean {
  for (let i = 0; i < DELOAD_LOOKBACK_WEEKS; i++) {
    const windowEnd = now - i * WEEK_MS;
    const windowStart = windowEnd - WEEK_MS;
    const inWindow = workoutLogs.filter(
      (l) => l.createdAt >= windowStart && l.createdAt < windowEnd
    );
    if (inWindow.length === 0) return false;
    const avg =
      inWindow.reduce(
        (sum, l) => sum + (INTENSITY_WEIGHT[l.intensity] ?? FALLBACK_WEIGHT),
        0
      ) / inWindow.length;
    if (avg < DELOAD_INTENSITY_THRESHOLD) return false;
  }
  return true;
}

/**
 * Cap today's intensity to "light" during a deload week. Only lowers
 * full/moderate; light and recovery are never touched (recovery stays the
 * safety/pain lane). Exported for unit testing.
 */
export function applyDeloadCap(
  intensity: SessionIntensity,
  isDeloadWeek: boolean
): SessionIntensity {
  if (!isDeloadWeek) return intensity;
  if (intensity === "full" || intensity === "moderate") return "light";
  return intensity;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "shouldDeload"`
Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "applyDeloadCap"`
Expected: PASS (5 + 5 tests)

- [ ] **Step 5: Wire into `generateSession` with reasoning line**

In `src/lib/decision-engine.ts`, inside `generateSession` (currently lines 355-545), replace the intensity-decision block (currently lines 374-402):

```ts
  // 2. Recovery / readiness.
  const baseIntensity = decideIntensity(checkIn);
  const afterLoad = applyLoadSuppression(
    baseIntensity,
    checkIn,
    inputs.workoutLogs ?? [],
    checkIn.createdAt
  );
  // Load suppression only lowers a full/moderate base, and decideIntensity
  // already returns "light" for recovery <= 2 — so in the live pipeline the
  // gate (recovery <= 3) effectively fires at recovery === 3.
  const suppressed = afterLoad !== baseIntensity;
  const isDeloadWeek = shouldDeload(inputs.workoutLogs ?? [], checkIn.createdAt);
  const intensity = applyDeloadCap(afterLoad, isDeloadWeek);
  const deloaded = intensity !== afterLoad;
  if (suppressed) {
    // The load line explains the lowered tier; skip the readiness descriptor
    // below so we don't also claim readiness was low when it wasn't.
    reasoning.push(
      "Beban 2 hari terakhir cukup berat & pemulihan pas-pasan — turunkan satu tingkat hari ini."
    );
  } else if (intensity === "recovery") {
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
  if (deloaded) {
    reasoning.push(
      "Beban latihan konsisten tinggi 4 minggu terakhir — minggu ini deload, turunkan volume buat recovery."
    );
  }
```

Then update the goal weights call (currently line 421) to pass the reassessment through:
```ts
  const weights = deriveGoalWeights(assessment, inputs.latestReassessment);
```

And add `latestReassessment` to the `EngineInputs` interface (currently lines 40-52), after `ownedEquipment`:
```ts
  /** Most recent weekly self-report (M13); undefined if never filled. */
  latestReassessment?: ReassessmentLog;
```

- [ ] **Step 6: Run the full decision-engine suite**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts`
Expected: all tests PASS — no existing test constructs 4 weeks of heavy `workoutLogs`, so `isDeloadWeek` is `false` in every pre-existing test and `afterLoad`/`intensity` stay equal, preserving prior behavior exactly.

- [ ] **Step 7: Add one integration test for the deload path**

Add to `src/lib/__tests__/decision-engine.test.ts`, inside `describe("generateSession — M10 recovery load", ...)` or as a new sibling `describe` block right after it:

```ts
describe("generateSession — M13 deload", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("caps a full-readiness day to light when 4 weeks were consistently heavy", () => {
    const now = 1_000_000_000;
    const heavyLogs: WorkoutLog[] = [1, 8, 15, 22].map((d) => ({
      id: `w-${d}`,
      userId: "u1",
      createdAt: now - d * DAY,
      movementFocus: "x",
      intensity: "full",
      estimatedMinutes: 30,
      exercises: [{ exerciseId: "e1", name: "e1", domain: "core", completed: true }],
      postSessionPain: 1,
    }));
    const result = generateSession(
      inputs({
        checkIn: checkIn({
          createdAt: now,
          painLevel: 1,
          recovery: 5,
          energyLevel: 5,
          sleepQuality: 5,
        }),
        workoutLogs: heavyLogs,
      })
    );
    expect(result.intensity).toBe("light");
    expect(
      result.reasoning.some((r) => r.includes("deload"))
    ).toBe(true);
  });

  it("does not deload without 4 consistent weeks of history", () => {
    const now = 1_000_000_000;
    const result = generateSession(
      inputs({
        checkIn: checkIn({
          createdAt: now,
          painLevel: 1,
          recovery: 5,
          energyLevel: 5,
          sleepQuality: 5,
        }),
        workoutLogs: [],
      })
    );
    expect(result.intensity).toBe("full");
    expect(result.reasoning.some((r) => r.includes("deload"))).toBe(false);
  });
});
```

- [ ] **Step 8: Run the full decision-engine suite again**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts`
Expected: PASS, all tests including the 2 new integration tests.

- [ ] **Step 9: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat(m13): deload detection and intensity cap"
```

---

### Task 6: `/reassess` page

**Files:**
- Create: `src/app/reassess/page.tsx`

**Interfaces:**
- Consumes: `ScalePicker` (`src/components/ui/scale-picker.tsx`), `Card`/`CardTitle` (`src/components/ui/card.tsx`), `Label` (`src/components/ui/label.tsx`), `Textarea` (`src/components/ui/textarea.tsx`), `Button` (`src/components/ui/button.tsx`), `TopBar` (`src/components/nav/top-bar.tsx`), `useAppStore` (Task 3), `putReassessmentLog` (Task 2), `newReassessmentLogInputSchema` (Task 1).
- Produces: route `/reassess`, consumed by Task 7's banner link.

No unit test — this is a client page verified via the browser in Task 8's manual verification pass, following the same convention as `checkin/page.tsx` and `progress/page.tsx` (no `.test.tsx` files exist for pages in this codebase; confirm with `Glob` for `src/app/**/*.test.tsx` before skipping if that's changed).

- [ ] **Step 1: Check the Textarea component's props**

Run: `Read src/components/ui/textarea.tsx` to confirm its prop shape before use (expected to mirror `Input`: forwards standard `<textarea>` props plus `className`).

- [ ] **Step 2: Write the page**

Create `src/app/reassess/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScalePicker } from "@/components/ui/scale-picker";
import { newReassessmentLogInputSchema } from "@/lib/log-schemas";
import { putReassessmentLog } from "@/lib/db";
import { useAppStore } from "@/lib/store";

export default function ReassessPage() {
  const router = useRouter();
  const { user, hydrated, hydrate, latestAssessment, refreshReassessment } =
    useAppStore();

  const [flexibility, setFlexibility] = useState(3);
  const [balance, setBalance] = useState(3);
  const [breathingQuality, setBreathingQuality] = useState(3);
  const [painAreas, setPainAreas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  async function onSubmit() {
    if (!user) return;
    const parsed = newReassessmentLogInputSchema.safeParse({
      userId: user.id,
      flexibility,
      balance,
      breathingQuality,
      painAreas: painAreas || undefined,
    });
    if (!parsed.success) {
      setError("Periksa lagi isian kamu.");
      return;
    }
    setSaving(true);
    await putReassessmentLog({
      ...parsed.data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    });
    await refreshReassessment();
    router.push("/workout");
  }

  if (hydrated && !latestAssessment) {
    return (
      <div className="px-5 pt-6">
        <Card>
          <p className="text-sm text-muted-foreground">
            Isi asesmen awal dulu sebelum reassessment mingguan.
          </p>
          <Link
            href="/assessment"
            className="mt-3 inline-block text-sm font-semibold text-primary"
          >
            Ke asesmen awal →
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <TopBar
        title="Reassessment mingguan"
        subtitle="Kondisi kamu minggu ini — dipakai buat sesuaikan fokus latihan."
      />

      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card>
          <Label>Fleksibilitas minggu ini</Label>
          <ScalePicker
            value={flexibility}
            onChange={setFlexibility}
            lowLabel="Kaku"
            highLabel="Lentur"
          />
        </Card>

        <Card>
          <Label>Keseimbangan minggu ini</Label>
          <ScalePicker
            value={balance}
            onChange={setBalance}
            lowLabel="Goyah"
            highLabel="Stabil"
          />
        </Card>

        <Card>
          <Label>Kualitas napas minggu ini</Label>
          <ScalePicker
            value={breathingQuality}
            onChange={setBreathingQuality}
            lowLabel="Sesak/dangkal"
            highLabel="Lega/dalam"
          />
        </Card>

        <Card>
          <Label htmlFor="pain-areas">Area nyeri (opsional)</Label>
          <Textarea
            id="pain-areas"
            value={painAreas}
            onChange={(e) => setPainAreas(e.target.value)}
            placeholder="Misal: punggung bawah, bahu kanan"
          />
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button size="lg" onClick={onSubmit} disabled={saving || !user}>
          {saving ? "Menyimpan…" : "Simpan reassessment"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `Textarea` props don't match (e.g. no `placeholder` or `onChange` typed differently), adjust the JSX to match the actual component signature read in Step 1.

- [ ] **Step 4: Commit**

```bash
git add src/app/reassess/page.tsx
git commit -m "feat(m13): weekly reassessment form page"
```

---

### Task 7: Reassessment prompt banner on the workout page + engine wiring

**Files:**
- Modify: `src/app/workout/page.tsx`

**Interfaces:**
- Consumes: `useAppStore().latestReassessment` (Task 3), `/reassess` route (Task 6).

- [ ] **Step 1: Add the banner and pass `latestReassessment` into `generateSession`**

In `src/app/workout/page.tsx`:

Add `latestReassessment` to the store destructure (line 29-37):
```ts
  const {
    hydrated,
    hydrate,
    latestAssessment,
    latestCheckIn,
    workoutLogs,
    latestReassessment,
    user,
    refreshLogs,
  } = useAppStore();
```

Add a computed flag after the `session` memo (after line 61):
```ts
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const needsReassessment =
    !latestReassessment || Date.now() - latestReassessment.createdAt >= SEVEN_DAYS_MS;
```

Pass `latestReassessment` into the `generateSession` call (inside the `useMemo`, currently lines 51-60):
```ts
    return generateSession({
      assessment: latestAssessment,
      checkIn: latestCheckIn,
      exercises,
      recentSessionTimestamps: workoutLogs.map((l) => l.createdAt),
      // Feeds deriveCapability so completed sessions ratchet difficulty over time.
      workoutLogs,
      preset: user?.trainingPreset ?? "balanced",
      ownedEquipment: user?.ownedEquipment ?? [],
      latestReassessment: latestReassessment ?? undefined,
    });
```
(and add `latestReassessment` to the `useMemo` dependency array, currently `[latestAssessment, latestCheckIn, exercises, workoutLogs, user]`)

Add the banner just before the final `return` JSX's opening `<TopBar .../>` — insert inside the returned `<div>`, right after `<TopBar ... />` (currently line 158), before the intensity `Card`:
```tsx
        {needsReassessment && (
          <Card className="border-primary/40 bg-primary/5">
            <p className="text-sm text-foreground">
              Sudah &ge;7 hari sejak reassessment mingguan terakhir.
            </p>
            <Link
              href="/reassess"
              className="mt-2 inline-block text-sm font-semibold text-primary"
            >
              Isi reassessment mingguan →
            </Link>
          </Card>
        )}
```
Note: this banner goes inside the `<div className="flex flex-col gap-4 px-5 pb-8">` wrapper (currently line 160), as the first child, since `Link` and `Card` are already imported in this file.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS (this task touches no pure functions, only a client page — no new unit tests, covered by Task 8's manual browser pass).

- [ ] **Step 4: Commit**

```bash
git add src/app/workout/page.tsx
git commit -m "feat(m13): reassessment banner on workout page + engine wiring"
```

---

### Task 8: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server and open `/reassess`**

Use the `run` skill or `preview_start` to launch the Next.js dev server. Navigate to `/reassess`. Confirm the three `ScalePicker` rows render, submitting redirects to `/workout`, and a `reassessmentLogs` record appears (check via browser devtools → Application → IndexedDB → `spinecoach-ai` → `reassessmentLogs`, or add a temporary console log and remove it after — do not leave debug code committed).

- [ ] **Step 2: Verify the banner on `/workout`**

With no reassessment ever filled, confirm the banner shows on `/workout`. After submitting the `/reassess` form, confirm the banner disappears (since `latestReassessment.createdAt` is now recent).

- [ ] **Step 3: Verify DB migration**

Confirm the app still loads correctly for a browser profile that already has `DB_VERSION 5` data (i.e. an existing session from before this change) — IndexedDB should upgrade to version 6 without errors, and existing `workoutLogs`/`benchmarkLogs` should remain intact. Check the browser console for IndexedDB errors.

- [ ] **Step 4: No commit needed — this is a verification task.** If any bug is found, fix it in the relevant task's files and commit there.

---

## Self-Review Notes

- **Spec coverage:** Bagian A (schema, storage, trigger, re-derive) → Tasks 1-4, 6-7. Bagian B (deload trigger, cap, wiring, reasoning) → Task 5. Testing section of spec → covered across Tasks 1, 4, 5 unit + integration tests.
- **Deviation from spec called out explicitly:** the spec's literal wording ("kalau kategori ada... kalau tidak ada, skip") is honored by mapping balance/breathingQuality to the existing `posture` category (which is the real lever gating stability/breathing domain slots) rather than treating them as no-ops. This is a stronger, still-compliant interpretation — flagged here for the spec-approver to confirm during review rather than buried in code.
- **Type consistency checked:** `ReassessmentLog` (Task 1) flows unchanged through `db.ts` (Task 2) → `store.ts` (Task 3) → `EngineInputs.latestReassessment` (Task 5) → `reassess/page.tsx` (Task 6) → `workout/page.tsx` (Task 7). `shouldDeload`/`applyDeloadCap` signatures match their call sites in Task 5 Step 5.
