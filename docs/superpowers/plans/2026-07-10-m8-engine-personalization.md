# M8 — Engine Personalization & Library Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rule-based decision engine reflect the user's assessment goals and demonstrated fitness, balance left/right work generically, and draw from a richer bodyweight-only library.

**Architecture:** Pure functions in `src/lib/decision-engine.ts` gain two derivations (goal weights, capability floor) and an upgraded picker; `src/lib/exercise-seed.ts` gains graded bodyweight movements. UI and IndexedDB are untouched. No new store, no `DB_VERSION` bump, no new dependency.

**Tech Stack:** TypeScript, Vitest, Zod (existing schemas only).

## Global Constraints

- Every exercise keeps `equipment: []`; the engine also filters `equipment.length === 0`.
- Side balancing is **generic** (equal left/right), never targeted at Cobb degrees or concave/convex sides (`docs/04_Clinical_Guardrails.md`).
- Red-flag escalation and readiness-based intensity capping are preserved unchanged.
- No new IndexedDB store, no `DB_VERSION` bump.
- Engine stays pure and deterministic: no network, no model call.
- Reasoning strings stay descriptive; never claim diagnosis or Cobb-angle change.
- All UI copy / cues in Indonesian, matching existing seed.

---

### Task 1: `deriveGoalWeights`

**Files:**
- Modify: `src/lib/decision-engine.ts`
- Test: `src/lib/__tests__/decision-engine.test.ts`

**Interfaces:**
- Consumes: `Assessment` (from `@/lib/schemas`).
- Produces: `interface GoalWeights { posture: number; strength: number; mobility: number; pain: number }` and `export function deriveGoalWeights(assessment: Assessment): GoalWeights`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/decision-engine.test.ts`:

```ts
import { deriveGoalWeights } from "@/lib/decision-engine";

describe("deriveGoalWeights", () => {
  it("weights posture and strength when both keywords appear", () => {
    const w = deriveGoalWeights({
      ...baseAssessment,
      primaryGoals: "Postur tegap dan tambah kekuatan otot",
    });
    expect(w.posture).toBeGreaterThan(0);
    expect(w.strength).toBeGreaterThan(0);
  });

  it("falls back to a balanced posture+strength default when nothing matches", () => {
    const w = deriveGoalWeights({ ...baseAssessment, primaryGoals: "xyz" });
    expect(w.posture).toBe(w.strength);
    expect(w.posture).toBeGreaterThan(0);
  });

  it("detects pain and mobility keywords", () => {
    const w = deriveGoalWeights({
      ...baseAssessment,
      primaryGoals: "Kurangi nyeri dan tingkatkan mobilitas",
    });
    expect(w.pain).toBeGreaterThan(0);
    expect(w.mobility).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t deriveGoalWeights`
Expected: FAIL — `deriveGoalWeights` is not exported.

- [ ] **Step 3: Implement `deriveGoalWeights`**

Add to `src/lib/decision-engine.ts` (after the imports, before `DIFFICULTY_CEILING`):

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t deriveGoalWeights`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: derive goal weights from assessment goals"
```

---

### Task 2: `deriveCapability`

**Files:**
- Modify: `src/lib/decision-engine.ts`
- Test: `src/lib/__tests__/decision-engine.test.ts`

**Interfaces:**
- Consumes: `Assessment`, `WorkoutLog` (from `@/lib/log-schemas`).
- Produces: `interface Capability { floorRank: 1 | 2 | 3 }` and `export function deriveCapability(assessment: Assessment, workoutLogs: WorkoutLog[]): Capability`. `floorRank` uses the same rank scale as `DIFFICULTY_RANK` (beginner 1, intermediate 2, advanced 3).

- [ ] **Step 1: Write the failing tests**

Append to the test file:

```ts
import { deriveCapability } from "@/lib/decision-engine";
import type { WorkoutLog } from "@/lib/log-schemas";

function log(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: "w1",
    userId: "u1",
    createdAt: 1_000,
    movementFocus: "x",
    intensity: "moderate",
    estimatedMinutes: 20,
    exercises: [
      { exerciseId: "e1", name: "e1", domain: "core", completed: true },
    ],
    postSessionPain: 1,
    ...overrides,
  };
}

describe("deriveCapability", () => {
  it("starts an active user at intermediate", () => {
    const cap = deriveCapability({ ...baseAssessment, activityLevel: "active" }, []);
    expect(cap.floorRank).toBe(2);
  });

  it("starts a sedentary user at beginner", () => {
    const cap = deriveCapability({ ...baseAssessment, activityLevel: "sedentary" }, []);
    expect(cap.floorRank).toBe(1);
  });

  it("bumps up after 3 clean, low-pain completions", () => {
    const cap = deriveCapability(
      { ...baseAssessment, activityLevel: "light" },
      [log(), log(), log()]
    );
    expect(cap.floorRank).toBe(2);
  });

  it("drops after a high-pain session", () => {
    const cap = deriveCapability(
      { ...baseAssessment, activityLevel: "active" },
      [log({ postSessionPain: 7 })]
    );
    expect(cap.floorRank).toBe(1);
  });

  it("never exceeds advanced", () => {
    const cap = deriveCapability(
      { ...baseAssessment, activityLevel: "active" },
      [log(), log(), log()]
    );
    expect(cap.floorRank).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t deriveCapability`
Expected: FAIL — `deriveCapability` is not exported.

- [ ] **Step 3: Implement `deriveCapability`**

Add the import at the top of `src/lib/decision-engine.ts`:

```ts
import type { WorkoutLog } from "@/lib/log-schemas";
```

Add after `deriveGoalWeights`:

```ts
export interface Capability {
  floorRank: 1 | 2 | 3;
}

const ACTIVITY_FLOOR: Record<Assessment["activityLevel"], 1 | 2 | 3> = {
  sedentary: 1,
  light: 1,
  moderate: 1,
  active: 2,
};

function clampRank(n: number): 1 | 2 | 3 {
  return Math.min(3, Math.max(1, n)) as 1 | 2 | 3;
}

/**
 * Difficulty floor the engine may start from, so a fit user is not locked into
 * beginner moves. Baseline from activityLevel; earned bump/drop from the most
 * recent workout logs (source of "stored progression" — no new store).
 */
export function deriveCapability(
  assessment: Assessment,
  workoutLogs: WorkoutLog[]
): Capability {
  let floor: number = ACTIVITY_FLOOR[assessment.activityLevel];
  const recent = workoutLogs.slice(0, 3);
  const cleanStreak =
    recent.length === 3 &&
    recent.every(
      (l) => l.exercises.every((e) => e.completed) && (l.postSessionPain ?? 0) <= 3
    );
  const latest = workoutLogs[0];
  const setback =
    latest !== undefined &&
    ((latest.postSessionPain ?? 0) >= 6 ||
      !latest.exercises.every((e) => e.completed));
  if (cleanStreak) floor += 1;
  if (setback) floor -= 1;
  return { floorRank: clampRank(floor) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t deriveCapability`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: derive fitness capability floor from activity and logs"
```

---

### Task 3: Upgrade `pickForDomain` (equipment filter + difficulty window + side balance)

**Files:**
- Modify: `src/lib/decision-engine.ts`
- Test: `src/lib/__tests__/decision-engine.test.ts`

**Interfaces:**
- Produces: new signature `pickForDomain(exercises: Exercise[], domain: ExerciseDomain, floorRank: number, ceilingRank: number, max: number): Exercise[]`. Behaviour: excludes any `equipment.length > 0`; prefers difficulty in `[floorRank, ceilingRank]`, relaxing the floor downward if the window is empty; when both `left` and `right` `sideEmphasis` variants are in range, returns a balanced pair before filling with `bilateral`. `pickForDomain` remains module-private; it is exercised through `generateSession` and a dedicated export-free test via a thin re-export below.

To make `pickForDomain` testable directly, export it:

- [ ] **Step 1: Write the failing tests**

Append:

```ts
import { pickForDomain } from "@/lib/decision-engine";

describe("pickForDomain", () => {
  it("excludes any exercise that needs equipment", () => {
    const geared = {
      ...EXERCISE_SEED[0],
      id: "geared",
      domain: "core" as const,
      equipment: ["band"],
      difficulty: "beginner" as const,
    };
    const picks = pickForDomain([geared, ...EXERCISE_SEED], "core", 1, 3, 5);
    expect(picks.some((e) => e.id === "geared")).toBe(false);
  });

  it("returns a balanced left/right pair when both exist", () => {
    const picks = pickForDomain(EXERCISE_SEED, "stability", 1, 3, 2);
    const sides = picks.map((e) => e.sideEmphasis).sort();
    expect(sides).toEqual(["left", "right"]);
  });

  it("keeps picks within the difficulty window", () => {
    const picks = pickForDomain(EXERCISE_SEED, "core", 2, 3, 5);
    expect(picks.every((e) => e.difficulty !== "beginner")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t pickForDomain`
Expected: FAIL — `pickForDomain` is not exported / signature mismatch.

- [ ] **Step 3: Replace `pickForDomain`**

In `src/lib/decision-engine.ts`, replace the existing `pickForDomain` function with:

```ts
/**
 * Pick exercises for a domain within a difficulty window, bodyweight only, with
 * generic left/right balancing. Never targets a specific curve (docs/04).
 * Exported for unit testing.
 */
export function pickForDomain(
  exercises: Exercise[],
  domain: ExerciseDomain,
  floorRank: number,
  ceilingRank: number,
  max: number
): Exercise[] {
  const bodyweight = exercises.filter(
    (ex) => ex.domain === domain && ex.equipment.length === 0
  );
  const inWindow = bodyweight.filter((ex) => {
    const r = DIFFICULTY_RANK[ex.difficulty];
    return r >= floorRank && r <= ceilingRank;
  });
  // If the window is empty, relax the floor down to beginner so a block is
  // never silently dropped; still respect the ceiling (safety).
  const pool =
    inWindow.length > 0
      ? inWindow
      : bodyweight.filter((ex) => DIFFICULTY_RANK[ex.difficulty] <= ceilingRank);

  const byEasiest = [...pool].sort(
    (a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]
  );

  const lefts = byEasiest.filter((e) => e.sideEmphasis === "left");
  const rights = byEasiest.filter((e) => e.sideEmphasis === "right");
  const result: Exercise[] = [];

  // Generic balance: if we have both sides and room for a pair, take one each.
  if (lefts.length > 0 && rights.length > 0 && max >= 2) {
    result.push(lefts[0], rights[0]);
  }
  for (const ex of byEasiest) {
    if (result.length >= max) break;
    if (result.includes(ex)) continue;
    result.push(ex);
  }
  return result.slice(0, max);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t pickForDomain`
Expected: PASS (3 tests). Note: `generateSession` still calls the old 4-arg signature and will fail to compile — Task 4 fixes the call site. Run the *scoped* test only here.

- [ ] **Step 5: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: bodyweight filter, difficulty window, side balance in picker"
```

---

### Task 4: Wire capability, window, and goal weights into `generateSession`

**Files:**
- Modify: `src/lib/decision-engine.ts:115-200` (the `generateSession` body)
- Test: `src/lib/__tests__/decision-engine.test.ts`

**Interfaces:**
- Consumes: `deriveGoalWeights`, `deriveCapability`, upgraded `pickForDomain`, existing `decideIntensity`, `EngineInputs` (already carries `assessment`, `checkIn`, `exercises`, `recentSessionTimestamps`).
- Produces: unchanged `GeneratedSession` shape. `EngineInputs` gains an optional field `workoutLogs?: WorkoutLog[]` (defaults to `[]`) so capability can read history without a new store.

- [ ] **Step 1: Write the failing tests**

Append:

```ts
describe("generateSession — personalization", () => {
  it("an active, ready user gets non-beginner strength work", () => {
    const result = generateSession(
      inputs({
        assessment: {
          ...baseAssessment,
          activityLevel: "active",
          primaryGoals: "Tambah kekuatan otot dan postur tegap",
        },
        checkIn: checkIn({ painLevel: 1, recovery: 5, energyLevel: 5, sleepQuality: 5 }),
      })
    );
    const strength = result.blocks.find((b) => b.domain === "strength");
    expect(strength).toBeDefined();
    expect(strength!.exercises.some((e) => e.difficulty !== "beginner")).toBe(true);
  });

  it("balanced focus produces both a stability and a strength block", () => {
    const result = generateSession(
      inputs({
        assessment: { ...baseAssessment, activityLevel: "moderate" },
        checkIn: checkIn({ availableMinutes: 60 }),
      })
    );
    expect(result.blocks.some((b) => b.domain === "stability")).toBe(true);
    expect(result.blocks.some((b) => b.domain === "strength")).toBe(true);
  });

  it("still escalates on a red flag", () => {
    const result = generateSession(
      inputs({
        assessment: {
          ...baseAssessment,
          redFlags: { ...noRedFlags, trauma: true },
        },
      })
    );
    expect(result.escalated).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t personalization`
Expected: FAIL — active user still gets beginner-only picks / compile error on old signature.

- [ ] **Step 3: Update `EngineInputs` and `generateSession`**

Add the optional field to `EngineInputs`:

```ts
export interface EngineInputs {
  assessment: Assessment;
  checkIn: CheckIn;
  exercises: Exercise[];
  /** Timestamps (ms) of recent completed sessions, newest first. */
  recentSessionTimestamps: number[];
  /** Recent workout logs, newest first — feeds capability. Defaults to []. */
  workoutLogs?: WorkoutLog[];
}
```

In `generateSession`, after `const intensity = decideIntensity(checkIn);` compute the window and weights:

```ts
  const ceilingRank = DIFFICULTY_CEILING[intensity];
  const capability = deriveCapability(assessment, inputs.workoutLogs ?? []);
  const floorRank = Math.min(capability.floorRank, ceilingRank);
  const weights = deriveGoalWeights(assessment);
```

Replace the session-building loop's `pickForDomain` call and per-domain `max`:

```ts
  for (const step of sequence) {
    const boosted =
      (step.domain === "strength" && weights.strength > 0) ||
      ((step.domain === "stability" || step.domain === "breathing") &&
        weights.posture > 0);
    const max = intensity === "recovery" ? 2 : boosted ? 3 : 2;
    const picks =
      intensity === "recovery"
        ? pickForDomain(exercises, step.domain, 0, 0, max)
        : pickForDomain(exercises, step.domain, floorRank, ceilingRank, max);
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
```

Note: for `recovery` the window `(0,0)` combined with the existing relax-down fallback yields the easiest available moves, matching prior behaviour (recovery/breathing/mobility only, since `RECOVERY_SEQUENCE` limits the domains).

- [ ] **Step 4: Run the full engine suite**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts`
Expected: PASS (all prior + new). Confirm the legacy "only picks beginner moves on a light day" test still passes (light day → ceilingRank 1 → floorRank 1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: personalize session by capability, difficulty window, and goals"
```

---

### Task 5: Expand the bodyweight library

**Files:**
- Modify: `src/lib/exercise-seed.ts`
- Test: `src/lib/__tests__/decision-engine.test.ts`

**Interfaces:**
- Consumes/Produces: `EXERCISE_SEED: Exercise[]` (unchanged export). New entries all satisfy `exerciseSchema` and keep `equipment: []`.

- [ ] **Step 1: Write the failing tests**

Append:

```ts
import { exerciseSchema } from "@/lib/exercise-schemas";

describe("EXERCISE_SEED integrity", () => {
  it("is entirely bodyweight", () => {
    expect(EXERCISE_SEED.every((e) => e.equipment.length === 0)).toBe(true);
  });

  it("every entry validates against the schema", () => {
    for (const ex of EXERCISE_SEED) {
      expect(() => exerciseSchema.parse(ex)).not.toThrow();
    }
  });

  it("has unique ids and resolvable progression/regression links", () => {
    const ids = new Set(EXERCISE_SEED.map((e) => e.id));
    expect(ids.size).toBe(EXERCISE_SEED.length);
    for (const ex of EXERCISE_SEED) {
      if (ex.progressionId) expect(ids.has(ex.progressionId)).toBe(true);
      if (ex.regressionId) expect(ids.has(ex.regressionId)).toBe(true);
    }
  });

  it("has at least 5 strength movements after expansion", () => {
    expect(EXERCISE_SEED.filter((e) => e.domain === "strength").length).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "EXERCISE_SEED integrity"`
Expected: FAIL on the "at least 5 strength" assertion (currently 3); the integrity checks should pass.

- [ ] **Step 3: Append new exercises**

Insert these objects into the `EXERCISE_SEED` array in `src/lib/exercise-seed.ts`, before the closing `];`:

```ts
  // Strength — push-up progression chain (all bodyweight).
  {
    id: "ex-wall-pushup",
    name: "Wall Push-up",
    domain: "strength",
    difficulty: "beginner",
    durationSeconds: 45,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Tubuh lurus dari kepala ke tumit", "Tekuk siku terkontrol"],
    contraindications: ["Nyeri bahu saat menekan"],
    progressionId: "ex-incline-pushup",
    regressionId: null,
    videoUrl: null,
  },
  {
    id: "ex-incline-pushup",
    name: "Incline Push-up",
    domain: "strength",
    difficulty: "beginner",
    durationSeconds: 45,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Tumpu di meja/kursi kokoh", "Core aktif, jangan melengkung"],
    contraindications: ["Nyeri bahu saat menekan", "Nyeri pergelangan tangan"],
    progressionId: "ex-knee-pushup",
    regressionId: "ex-wall-pushup",
    videoUrl: null,
  },
  {
    id: "ex-knee-pushup",
    name: "Knee Push-up",
    domain: "strength",
    difficulty: "intermediate",
    durationSeconds: 45,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Tumpu di lutut", "Garis lurus bahu ke lutut"],
    contraindications: ["Nyeri bahu saat menekan", "Nyeri lutut menumpu"],
    progressionId: "ex-full-pushup",
    regressionId: "ex-incline-pushup",
    videoUrl: null,
  },
  {
    id: "ex-full-pushup",
    name: "Full Push-up",
    domain: "strength",
    difficulty: "advanced",
    durationSeconds: 45,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Tubuh satu garis", "Turun sampai dada dekat lantai"],
    contraindications: ["Nyeri bahu saat menekan", "Punggung bawah melengkung"],
    progressionId: null,
    regressionId: "ex-knee-pushup",
    videoUrl: null,
  },
  {
    id: "ex-split-squat",
    name: "Split Squat",
    domain: "strength",
    difficulty: "intermediate",
    durationSeconds: 60,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Langkah satu kaki ke depan", "Turun lurus, lutut depan di atas mata kaki"],
    contraindications: ["Nyeri lutut menekuk beban", "Keseimbangan buruk tanpa pegangan"],
    progressionId: null,
    regressionId: "ex-wall-sit",
    videoUrl: null,
  },
  {
    id: "ex-reverse-lunge",
    name: "Reverse Lunge",
    domain: "strength",
    difficulty: "intermediate",
    durationSeconds: 60,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Langkah mundur terkontrol", "Jaga badan tegak"],
    contraindications: ["Nyeri lutut", "Keseimbangan buruk"],
    progressionId: null,
    regressionId: "ex-wall-sit",
    videoUrl: null,
  },
  {
    id: "ex-calf-raise",
    name: "Calf Raise",
    domain: "strength",
    difficulty: "beginner",
    durationSeconds: 45,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Angkat tumit pelan", "Tahan sebentar di atas, turun terkontrol"],
    contraindications: ["Nyeri tendon achilles"],
    progressionId: null,
    regressionId: null,
    videoUrl: null,
  },
  // Posture-focused (stability domain so the engine's posture boost picks them up).
  {
    id: "ex-wall-angel",
    name: "Wall Angel",
    domain: "stability",
    difficulty: "beginner",
    durationSeconds: 60,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Punggung & kepala nempel dinding", "Geser lengan naik-turun tetap menempel"],
    contraindications: ["Nyeri bahu saat mengangkat lengan"],
    progressionId: "ex-prone-ytw",
    regressionId: null,
    videoUrl: null,
  },
  {
    id: "ex-prone-ytw",
    name: "Prone Y-T-W Raises",
    domain: "stability",
    difficulty: "intermediate",
    durationSeconds: 60,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Tengkurap, angkat lengan bentuk Y-T-W", "Remas tulang belikat"],
    contraindications: ["Nyeri bahu saat mengangkat", "Nyeri leher saat tengkurap"],
    progressionId: null,
    regressionId: "ex-wall-angel",
    videoUrl: null,
  },
  {
    id: "ex-chin-tuck",
    name: "Chin Tuck",
    domain: "stability",
    difficulty: "beginner",
    durationSeconds: 45,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Tarik dagu ke belakang (dobel chin)", "Tahan 3 detik, rileks"],
    contraindications: ["Pusing saat gerak leher", "Nyeri leher tajam"],
    progressionId: null,
    regressionId: null,
    videoUrl: null,
  },
  {
    id: "ex-prone-press-up",
    name: "Prone Press-up",
    domain: "mobility",
    difficulty: "beginner",
    durationSeconds: 60,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Tengkurap, dorong dada naik pakai lengan", "Panggul tetap di lantai"],
    contraindications: ["Nyeri tajam saat ekstensi punggung", "Nyeri menjalar ke kaki"],
    progressionId: null,
    regressionId: null,
    videoUrl: null,
  },
  // Core additions.
  {
    id: "ex-front-plank-knees",
    name: "Front Plank Lutut",
    domain: "core",
    difficulty: "beginner",
    durationSeconds: 40,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Tumpu siku & lutut", "Garis lurus bahu ke lutut, core aktif"],
    contraindications: ["Nyeri bahu tumpu", "Nyeri pinggang saat menahan"],
    progressionId: "ex-front-plank",
    regressionId: null,
    videoUrl: null,
  },
  {
    id: "ex-front-plank",
    name: "Front Plank",
    domain: "core",
    difficulty: "intermediate",
    durationSeconds: 40,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Tumpu siku & ujung kaki", "Panggul netral, jangan turun"],
    contraindications: ["Nyeri bahu tumpu", "Punggung bawah melengkung"],
    progressionId: "ex-hollow-hold",
    regressionId: "ex-front-plank-knees",
    videoUrl: null,
  },
  {
    id: "ex-hollow-hold",
    name: "Hollow-Body Hold",
    domain: "core",
    difficulty: "advanced",
    durationSeconds: 40,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Punggung bawah nempel lantai", "Angkat bahu & kaki, tahan"],
    contraindications: ["Punggung bawah terangkat tak terkontrol", "Nyeri leher"],
    progressionId: null,
    regressionId: "ex-front-plank",
    videoUrl: null,
  },
```

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS — all suites, including the integrity checks and prior personalization tests. If any progression/regression id fails to resolve, correct the referenced id.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/exercise-seed.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: expand bodyweight library with graded strength, posture, core moves"
```

---

### Task 6: End-to-end verification in the running app

**Files:** none (verification only).

- [ ] **Step 1: Confirm seeded exercises reach an existing device**

`seedExercisesIfEmpty` only writes when the store is empty, so a device that already seeded the old 18 exercises will NOT gain the new ones automatically. Decide: for the owner's device, the exercises store must be re-seeded. In the browser preview console (dev only), clear just the exercises store, then reload:

```js
indexedDB.open('spinecoach-ai').onsuccess = (e) => {
  e.target.result.transaction('exercises','readwrite').objectStore('exercises').clear();
};
```

Then reload; `seedExercisesIfEmpty` repopulates with the full set.

- [ ] **Step 2: Drive the flow**

Open the app → Check-in (enter a ready day: low pain, high recovery) → view Today's Workout. Confirm the session includes a strength block with a non-beginner movement and that stability/side-plank picks are one left + one right.

- [ ] **Step 3: Screenshot proof**

Capture the generated workout screen and confirm no console errors.

---

## Self-Review Notes

- **Spec coverage:** goal weights (T1), capability/baseline+progression (T2), equipment filter + side balance + window (T3), engine wiring + goal-weighted slots (T4), library expansion (T5), verification (T6). All spec §1–§6 covered.
- **Guardrails:** side balancing generic only; no Cobb/diagnosis copy added; red-flag escalation retested in T4.
- **No migration:** capability derives from stored `WorkoutLog`s; T6 notes the manual re-seed needed because `seedExercisesIfEmpty` is idempotent.
- **Type consistency:** `floorRank`/`ceilingRank` use the `DIFFICULTY_RANK` scale throughout; `pickForDomain` 5-arg signature is defined in T3 and called in T4; `EngineInputs.workoutLogs?` defined in T4 and consumed via `deriveCapability` from T2.
