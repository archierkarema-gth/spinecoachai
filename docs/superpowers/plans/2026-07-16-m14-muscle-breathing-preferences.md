# M14 — Preferensi Otot & Napas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `muscles[]` tag to exercises, `weakMuscles[]`/`tightMuscles[]`/`breathingPattern` profile preferences that bias exercise ordering within a domain (never slot counts), and a display-only weekly-volume-per-domain card on the Progress page.

**Architecture:** Pure additive Zod fields (no IndexedDB migration — all new fields optional). `pickForDomain` in `src/lib/decision-engine.ts` gets a secondary sort key for muscle-tag overlap; `generateSession` wires it from the assessment. A new pure helper in `src/lib/progress.ts` derives per-domain weekly volume from existing `workoutLogs`, rendered read-only on the Progress page.

**Tech Stack:** Next.js (App Router), TypeScript, Zod, Vitest, react-hook-form + `@hookform/resolvers/zod`.

## Global Constraints

- Engine stays pure/deterministic — no network/model calls in `src/lib/decision-engine.ts` or `src/lib/progress.ts`.
- Never target a specific curve or estimate a Cobb angle — `MuscleGroup` values are generic muscle names only.
- Safety/recovery always wins; corrective domains are never zeroed. This plan must not touch `slotMaxFor`, `boosted`, or domain slot counts — only ordering within a domain.
- All new schema fields are optional with no forced default that breaks existing stored data (`muscles` defaults to `[]` on read via `.default([])`; `weakMuscles`/`tightMuscles`/`breathingPattern` are `.optional()` with no default).
- No IndexedDB `DB_VERSION` bump — these are new optional fields on existing stores (`assessments`, exercise seed is static data, not a store).
- `tightMuscles` bias only applies inside the `mobility` domain; `weakMuscles` bias applies across all domains.
- `breathingPattern` never re-derives `GoalWeights` (avoid duplicating M13's `breathingQuality → posture` bump) — it only adds a reasoning line.
- Volume-per-domain (Task 7/8) is display-only — it must never be read by `generateSession` or any other engine function.

---

### Task 1: `MuscleGroup` type + exercise `muscles[]` field

**Files:**
- Modify: `src/lib/exercise-schemas.ts`
- Test: `src/lib/__tests__/schemas.test.ts` (new `describe("exerciseSchema muscles")` block — check this file's existing imports; if it doesn't import `exerciseSchema`, add a new test in `src/lib/__tests__/decision-engine.test.ts` top-level `describe("exerciseSchema muscles")` instead, since that file already imports `EXERCISE_SEED` and exercise types)

**Interfaces:**
- Produces: `muscleGroupEnum` (Zod enum), `MuscleGroup` (TS type), `exerciseSchema` gains field `muscles: MuscleGroup[]` (default `[]`).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/__tests__/decision-engine.test.ts` (near the top, after existing imports — check current imports first with Read; add `exerciseSchema` to the import from `@/lib/exercise-schemas` if not already present):

```ts
import { exerciseSchema } from "@/lib/exercise-schemas";

describe("exerciseSchema muscles field", () => {
  it("defaults muscles to an empty array when omitted", () => {
    const { muscles, ...rest } = EXERCISE_SEED[0];
    const parsed = exerciseSchema.parse(rest);
    expect(parsed.muscles).toEqual([]);
  });

  it("accepts a list of known muscle groups", () => {
    const parsed = exerciseSchema.parse({
      ...EXERCISE_SEED[0],
      muscles: ["glute", "hamstring"],
    });
    expect(parsed.muscles).toEqual(["glute", "hamstring"]);
  });

  it("rejects an unknown muscle group", () => {
    expect(() =>
      exerciseSchema.parse({ ...EXERCISE_SEED[0], muscles: ["bicep"] })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "exerciseSchema muscles field"`
Expected: FAIL — `muscles` is not a recognized field / `exerciseSchema.parse` throws on the first case because `muscles` is undefined but not defaulted yet (or TS compile error if `muscles` isn't optional-safe — the destructure `{ muscles, ...rest }` will just be `undefined` pre-change, so the real failure is the second/third test: `parsed.muscles` won't equal `["glute","hamstring"]` because the schema doesn't know that key, and Zod strips unknown keys by default so it'll actually just be `undefined`, failing the `toEqual` assertion).

- [ ] **Step 3: Write minimal implementation**

In `src/lib/exercise-schemas.ts`, after the `sideEmphasisEnum` block (after line 29) add:

```ts
// Generic muscle groups a movement primarily targets. Used to bias exercise
// *ordering* within a domain toward a user's weak/tight muscles — never a
// spine curve or biomechanical segment (docs/04_Clinical_Guardrails.md).
export const muscleGroupEnum = z.enum([
  "hip-flexor",
  "hamstring",
  "glute",
  "quad",
  "calf",
  "adductor",
  "core",
  "lower-back",
  "upper-back",
  "lat",
  "trap",
  "shoulder",
  "rotator-cuff",
  "chest",
  "neck",
]);
export type MuscleGroup = z.infer<typeof muscleGroupEnum>;
```

Then in `exerciseSchema` (around line 46, right before `videoUrl`), add:

```ts
  videoUrl: z.string().nullable(),
  // 1-3 primary muscle groups this movement targets. Defaults to [] so
  // pre-M14 seed data (not yet retagged) still validates.
  muscles: z.array(muscleGroupEnum).default([]),
```

(Keep `videoUrl` where it is; just add `muscles` as the new last field.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "exerciseSchema muscles field"`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/exercise-schemas.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat(m14): add muscleGroupEnum and exercise muscles[] field"
```

---

### Task 2: Profile `weakMuscles[]` / `tightMuscles[]` / `breathingPattern`

**Files:**
- Modify: `src/lib/schemas.ts`
- Test: `src/lib/__tests__/schemas.test.ts`

**Interfaces:**
- Consumes: `muscleGroupEnum`, `MuscleGroup` from Task 1 (`@/lib/exercise-schemas`).
- Produces: `breathingPatternEnum` (Zod enum), `BreathingPattern` (TS type), `Assessment` gains `weakMuscles?: MuscleGroup[]`, `tightMuscles?: MuscleGroup[]`, `breathingPattern?: BreathingPattern`.

- [ ] **Step 1: Write the failing test**

First read `src/lib/__tests__/schemas.test.ts` to match its existing style (base assessment fixture name), then add:

```ts
import { muscleGroupEnum } from "@/lib/exercise-schemas";

describe("assessmentSchema muscle & breathing preferences", () => {
  it("accepts an assessment with no weakMuscles/tightMuscles/breathingPattern", () => {
    const parsed = assessmentSchema.parse(baseAssessment);
    expect(parsed.weakMuscles).toBeUndefined();
    expect(parsed.tightMuscles).toBeUndefined();
    expect(parsed.breathingPattern).toBeUndefined();
  });

  it("accepts valid muscle groups and a breathing pattern", () => {
    const parsed = assessmentSchema.parse({
      ...baseAssessment,
      weakMuscles: ["glute", "core"],
      tightMuscles: ["hip-flexor"],
      breathingPattern: "chest-dominant",
    });
    expect(parsed.weakMuscles).toEqual(["glute", "core"]);
    expect(parsed.tightMuscles).toEqual(["hip-flexor"]);
    expect(parsed.breathingPattern).toBe("chest-dominant");
  });

  it("rejects an invalid breathingPattern value", () => {
    expect(() =>
      assessmentSchema.parse({ ...baseAssessment, breathingPattern: "mouth" })
    ).toThrow();
  });
});
```

(Use whatever the file's existing base fixture is called — check the top of `src/lib/__tests__/schemas.test.ts` for the exact fixture variable name, e.g. `baseAssessment`, and reuse it exactly as named there.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/schemas.test.ts -t "assessmentSchema muscle & breathing preferences"`
Expected: FAIL — `weakMuscles`/`tightMuscles`/`breathingPattern` are unknown fields, `parsed.weakMuscles` is `undefined` in the second test where it should equal an array (Zod strips unknown keys silently, so it fails the `toEqual` assertion, not a thrown error).

- [ ] **Step 3: Write minimal implementation**

In `src/lib/schemas.ts`:
1. Add import at top: `import { muscleGroupEnum, type MuscleGroup } from "@/lib/exercise-schemas";`
2. After `trainingPresetEnum` (line 35), add:

```ts
export const breathingPatternEnum = z.enum([
  "chest-dominant",
  "diaphragmatic",
  "shallow",
  "not-sure",
]);
export type BreathingPattern = z.infer<typeof breathingPatternEnum>;
```

3. In `assessmentSchema`, right before `redFlags: redFlagSymptomsSchema,` (line 69), add:

```ts
  // Preferences, not clinical curve data (docs/04). Optional — no default,
  // undefined means "not yet answered", distinct from an empty array.
  weakMuscles: z.array(muscleGroupEnum).optional(),
  tightMuscles: z.array(muscleGroupEnum).optional(),
  breathingPattern: breathingPatternEnum.optional(),

  redFlags: redFlagSymptomsSchema,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/schemas.test.ts -t "assessmentSchema muscle & breathing preferences"`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts src/lib/__tests__/schemas.test.ts
git commit -m "feat(m14): add weakMuscles/tightMuscles/breathingPattern to Assessment"
```

---

### Task 3: Retag exercise seed with `muscles[]`

**Files:**
- Modify: `src/lib/exercise-seed.ts` (all entries)
- Test: `src/lib/__tests__/decision-engine.test.ts` (extend the seed-integrity check, or add new)

**Interfaces:**
- Consumes: `MuscleGroup` from Task 1.
- Produces: every `Exercise` in `EXERCISE_SEED` has a non-empty `muscles` array (1-3 entries).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/__tests__/decision-engine.test.ts`:

```ts
describe("EXERCISE_SEED muscle tags", () => {
  it("tags every exercise with 1-3 primary muscle groups", () => {
    for (const ex of EXERCISE_SEED) {
      expect(ex.muscles.length).toBeGreaterThanOrEqual(1);
      expect(ex.muscles.length).toBeLessThanOrEqual(3);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "EXERCISE_SEED muscle tags"`
Expected: FAIL — every entry currently has `muscles: []` (default from Task 1), so `length >= 1` fails for all of them.

- [ ] **Step 3: Retag every entry**

Open `src/lib/exercise-seed.ts`. For each exercise object, add a `muscles: [...]` field (1-3 tags) based on its `name`/`domain`/`cues`. Use this mapping as the source of truth — go through the file top to bottom and add the field to every entry, matching by `id`:

| id pattern (or name) | muscles |
|---|---|
| breathing domain (diaphragmatic, 90/90, any breathing exercise) | `["core"]` |
| cat-cow, thread-the-needle, any spinal/thoracic rotation mobility move | `["upper-back"]` |
| any hip-flexor stretch / couch stretch / kneeling hip flexor mobility move | `["hip-flexor"]` |
| any hamstring stretch/mobility move | `["hamstring"]` |
| any ankle/calf mobility move | `["calf"]` |
| dead bug, bird dog, plank, side plank, any core-domain move | `["core"]` (add `["core","glute"]` if it's a side plank/bridge variant that also loads glute) |
| bridge, glute bridge, hip thrust, any glute-focused move | `["glute"]` |
| bird dog specifically (core + hip extension) | `["core", "glute"]` |
| single-leg stance, any balance-domain move | `["glute", "core"]` |
| wall sit, squat, any quad-dominant strength move | `["quad", "glute"]` |
| push-up and its progressions/regressions | `["chest", "shoulder"]` |
| row, band row, any pulling strength move | `["upper-back", "lat"]` |
| pull-up and its progression chain (dead hang, negative pull-up, etc.) | `["lat", "upper-back"]` |
| dip and dip progression chain | `["chest", "shoulder"]` |
| scapular wall slide / scapular control move | `["upper-back", "shoulder"]` |
| shoulder external rotation / band pull-apart / rotator-cuff-focused move | `["rotator-cuff", "shoulder"]` |
| neck retraction / chin tuck / any neck-domain move | `["neck", "upper-back"]` |
| adductor/groin stretch or Copenhagen-style move | `["adductor"]` |
| lower-back specific extension/McKenzie-style move | `["lower-back"]` |
| any conditioning-domain cardio move (step-ups, marching, etc.) | `["quad", "calf"]` |
| any recovery/cooldown stretch not covered above | tag by the muscle group it stretches, per the categories above |

Read the actual file to see every entry's real `name`/`domain`/`cues` and assign the closest-matching row above — do not leave any entry without a `muscles` field. If an exercise doesn't clearly match any row (rare), default to `["core"]` for `core`/`stability`/`breathing` domain items or `["glute"]` for `balance`/`conditioning` domain items, whichever is closer to the movement's visible target.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "EXERCISE_SEED muscle tags"`
Expected: PASS

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts`
Expected: All PASS (retagging must not change any `id`, `domain`, `equipment`, or other existing field)

- [ ] **Step 6: Commit**

```bash
git add src/lib/exercise-seed.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat(m14): retag exercise seed with primary muscles[]"
```

---

### Task 4: `pickForDomain` muscle-preference bias

**Files:**
- Modify: `src/lib/decision-engine.ts:356-412` (the `PickOptions` interface and `pickForDomain` function)
- Test: `src/lib/__tests__/decision-engine.test.ts`

**Interfaces:**
- Consumes: `MuscleGroup` from `@/lib/exercise-schemas` (Task 1), `Exercise.muscles` (Task 1/3).
- Produces: `PickOptions.preferMuscles?: Set<MuscleGroup>`, `PickOptions.preferMusclesInMobility?: Set<MuscleGroup>`. `pickForDomain` signature unchanged otherwise (same 6 params, `opts` gains 2 optional keys).

- [ ] **Step 1: Write the failing test**

Add to the existing `describe("pickForDomain", ...)` block in `src/lib/__tests__/decision-engine.test.ts` (after the `preferHardest` test, before the closing `});` at line 306):

```ts
  it("surfaces a preferMuscles-overlapping exercise first among same-difficulty candidates", () => {
    const a = {
      ...EXERCISE_SEED[0],
      id: "core-a",
      domain: "core" as const,
      difficulty: "beginner" as const,
      muscles: ["core"] as const,
    };
    const b = {
      ...EXERCISE_SEED[0],
      id: "core-b",
      domain: "core" as const,
      difficulty: "beginner" as const,
      muscles: ["glute"] as const,
    };
    const picks = pickForDomain([a, b], "core", 1, 3, 1, {
      preferMuscles: new Set(["glute"]),
    });
    expect(picks[0].id).toBe("core-b");
  });

  it("does not apply preferMusclesInMobility outside the mobility domain", () => {
    const a = {
      ...EXERCISE_SEED[0],
      id: "strength-a",
      domain: "strength" as const,
      difficulty: "beginner" as const,
      muscles: ["core"] as const,
    };
    const b = {
      ...EXERCISE_SEED[0],
      id: "strength-b",
      domain: "strength" as const,
      difficulty: "beginner" as const,
      muscles: ["hip-flexor"] as const,
    };
    const picks = pickForDomain([a, b], "strength", 1, 3, 1, {
      preferMusclesInMobility: new Set(["hip-flexor"]),
    });
    expect(picks[0].id).toBe("strength-a"); // original order, no bias applied
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "pickForDomain"`
Expected: FAIL on the first new test — `preferMuscles` isn't read yet, so `byPreference` order is unchanged (`core-a` stays first since both are the same difficulty and `core-a` comes first in the input array).

- [ ] **Step 3: Write minimal implementation**

In `src/lib/decision-engine.ts`, update `PickOptions` (around line 356-363):

```ts
export interface PickOptions {
  preferHardest?: boolean;
  /** Equipment the user owns; bodyweight (empty) is always allowed. */
  allowedEquipment?: Set<string>;
  /** M14: muscle groups from assessment.weakMuscles — biases ordering in every domain. */
  preferMuscles?: Set<MuscleGroup>;
  /** M14: muscle groups from assessment.tightMuscles — biases ordering in the mobility domain only. */
  preferMusclesInMobility?: Set<MuscleGroup>;
}
```

Add `MuscleGroup` to the type import at the top of the file (line 3-7):

```ts
import type {
  CheckIn,
  Exercise,
  ExerciseDomain,
  MuscleGroup,
} from "@/lib/exercise-schemas";
```

Replace the `byPreference` sort (lines 390-393):

```ts
  const dir = opts.preferHardest ? -1 : 1;
  const preferSet = new Set([
    ...(opts.preferMuscles ?? []),
    ...(domain === "mobility" ? opts.preferMusclesInMobility ?? [] : []),
  ]);
  const overlapsPreferred = (ex: Exercise) =>
    preferSet.size > 0 && ex.muscles.some((m) => preferSet.has(m));
  const byPreference = [...pool].sort((a, b) => {
    const rankDiff = dir * (DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]);
    if (rankDiff !== 0) return rankDiff;
    // Same difficulty rank: muscle-preference overlap breaks the tie.
    const aPref = overlapsPreferred(a) ? 1 : 0;
    const bPref = overlapsPreferred(b) ? 1 : 0;
    return bPref - aPref;
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "pickForDomain"`
Expected: PASS (all pickForDomain tests, including the 2 new ones)

- [ ] **Step 5: Run full decision-engine suite**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts`
Expected: All PASS (no regression to existing `preferHardest`/equipment/side-pairing behavior — the tie-break only activates when `rankDiff === 0` and a preference set is non-empty)

- [ ] **Step 6: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat(m14): bias pickForDomain ordering toward weak/tight muscle groups"
```

---

### Task 5: Wire `generateSession` + `breathingPattern` reasoning line

**Files:**
- Modify: `src/lib/decision-engine.ts:519-528` (the two `pickForDomain` call sites inside `generateSession`), plus the reasoning-assembly section (after line 469, near the intensity reasoning block)
- Test: `src/lib/__tests__/decision-engine.test.ts`

**Interfaces:**
- Consumes: `assessment.weakMuscles`, `assessment.tightMuscles`, `assessment.breathingPattern` (Task 2); `PickOptions.preferMuscles`/`preferMusclesInMobility` (Task 4).
- Produces: no new exported symbols — behavior change inside `generateSession` only.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/__tests__/decision-engine.test.ts`, a new top-level `describe`:

```ts
describe("generateSession — M14 muscle & breathing preferences", () => {
  it("adds a reasoning line when breathingPattern is chest-dominant", () => {
    const result = generateSession(
      inputs({
        assessment: { ...baseAssessment, breathingPattern: "chest-dominant" },
      })
    );
    expect(
      result.reasoning.some((line) => line.toLowerCase().includes("napas"))
    ).toBe(true);
  });

  it("does not add a breathing reasoning line when breathingPattern is diaphragmatic", () => {
    const chestResult = generateSession(
      inputs({ assessment: { ...baseAssessment, breathingPattern: "chest-dominant" } })
    );
    const diaphragmaticResult = generateSession(
      inputs({ assessment: { ...baseAssessment, breathingPattern: "diaphragmatic" } })
    );
    expect(diaphragmaticResult.reasoning.length).toBeLessThan(
      chestResult.reasoning.length
    );
  });

  it("does not change goal weights when breathingPattern is set (no duplication of M13 breathingQuality logic)", () => {
    const withPattern = generateSession(
      inputs({ assessment: { ...baseAssessment, breathingPattern: "chest-dominant" } })
    );
    const withoutPattern = generateSession(inputs({ assessment: baseAssessment }));
    // Same intensity/blocks structure driven by weights — same number of blocks.
    expect(withPattern.blocks.length).toBe(withoutPattern.blocks.length);
  });
});
```

Check `inputs(...)` and `baseAssessment` helper signatures already defined near the top of the test file (used throughout) and reuse them exactly as-is — do not redefine.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "M14 muscle & breathing preferences"`
Expected: FAIL on the first test — no reasoning line mentions "napas" from `breathingPattern` yet (the M13 `breathingQuality` line only fires from `latestReassessment`, not from `assessment.breathingPattern`).

- [ ] **Step 3: Write minimal implementation**

In `src/lib/decision-engine.ts`, inside `generateSession`, after the `weights = deriveGoalWeights(...)` line (line 493) add:

```ts
  const weakMusclePref = new Set(assessment.weakMuscles ?? []);
  const tightMusclePref = new Set(assessment.tightMuscles ?? []);
```

Update both `pickForDomain` call sites (lines 520-528) to pass the new opts:

```ts
    const picks =
      intensity === "recovery"
        ? pickForDomain(exercises, step.domain, 1, DIFFICULTY_RANK.beginner, max, {
            allowedEquipment,
            preferMuscles: weakMusclePref,
            preferMusclesInMobility: tightMusclePref,
          })
        : pickForDomain(exercises, step.domain, effectiveFloor, ceilingRank, max, {
            preferHardest: effectivePreferHardest,
            allowedEquipment,
            preferMuscles: weakMusclePref,
            preferMusclesInMobility: tightMusclePref,
          });
```

For the breathing reasoning line, add right after the existing intensity reasoning block (after line 469, before the `if (deloaded)` block at line 470):

```ts
  if (
    assessment.breathingPattern === "chest-dominant" ||
    assessment.breathingPattern === "shallow"
  ) {
    reasoning.push(
      "Pola napasmu cenderung dada/dangkal — sesi ini tetap mengutamakan latihan napas diafragma."
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "M14 muscle & breathing preferences"`
Expected: PASS (3 tests)

- [ ] **Step 5: Run full decision-engine suite**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat(m14): wire weakMuscles/tightMuscles into generateSession, add breathingPattern reasoning"
```

---

### Task 6: Onboarding assessment form — muscle checklists + breathing select

**Files:**
- Modify: `src/app/assessment/page.tsx`

**Interfaces:**
- Consumes: `muscleGroupEnum` (for the checklist option list), `NewAssessmentInput` (now includes `weakMuscles?`, `tightMuscles?`, `breathingPattern?` from Task 2).
- Produces: no new exported symbols — form UI only.

- [ ] **Step 1: Add the muscle group label map and options list**

In `src/app/assessment/page.tsx`, after the `RED_FLAG_FIELDS` constant (line 28), add:

```ts
const MUSCLE_GROUP_OPTIONS: { value: string; label: string }[] = [
  { value: "hip-flexor", label: "Panggul depan (hip flexor)" },
  { value: "hamstring", label: "Hamstring" },
  { value: "glute", label: "Bokong (glute)" },
  { value: "quad", label: "Paha depan (quad)" },
  { value: "calf", label: "Betis" },
  { value: "adductor", label: "Paha dalam (adductor)" },
  { value: "core", label: "Perut/core" },
  { value: "lower-back", label: "Punggung bawah" },
  { value: "upper-back", label: "Punggung atas" },
  { value: "lat", label: "Lat (sisi punggung)" },
  { value: "trap", label: "Trapezius (bahu-leher)" },
  { value: "shoulder", label: "Bahu" },
  { value: "rotator-cuff", label: "Rotator cuff" },
  { value: "chest", label: "Dada" },
  { value: "neck", label: "Leher" },
];
```

- [ ] **Step 2: Add checklists + breathing select to the form JSX**

Insert a new `<Card>` block right before the final red-flag `<Card>` (before line 225 `<Card className="flex flex-col gap-3">`):

```tsx
        <Card className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">
              Otot yang terasa lemah (opsional)
            </p>
            <div className="flex flex-col gap-2">
              {MUSCLE_GROUP_OPTIONS.map(({ value, label }) => (
                <label
                  key={`weak-${value}`}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    value={value}
                    {...register("weakMuscles")}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">
              Otot yang terasa kencang/kaku (opsional)
            </p>
            <div className="flex flex-col gap-2">
              {MUSCLE_GROUP_OPTIONS.map(({ value, label }) => (
                <label
                  key={`tight-${value}`}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    value={value}
                    {...register("tightMuscles")}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="breathingPattern">Pola napas (opsional)</Label>
            <select
              id="breathingPattern"
              className="h-11 w-full rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm"
              {...register("breathingPattern")}
            >
              <option value="not-sure">Tidak yakin</option>
              <option value="diaphragmatic">Napas perut (diafragma)</option>
              <option value="chest-dominant">Napas dada</option>
              <option value="shallow">Napas dangkal</option>
            </select>
          </div>
        </Card>
```

- [ ] **Step 3: Add default values for the new fields**

In the `useForm` `defaultValues` (lines 45-58), add:

```ts
      weakMuscles: [],
      tightMuscles: [],
      breathingPattern: "not-sure",
```

(Insert after `activityLevel: "light",` — anywhere inside the object works since it's a flat object literal.)

- [ ] **Step 4: Manually verify via dev server**

Run: `npm run dev` (or use the project's existing dev script), navigate to `/assessment`, confirm:
- Both checklists render all 15 options with Indonesian labels.
- Breathing select defaults to "Tidak yakin".
- Submitting with nothing checked still succeeds (fields are optional).
- Submitting with some boxes checked and re-opening dev tools → Application → IndexedDB → `assessments` store shows the array values saved on the record.

- [ ] **Step 5: Commit**

```bash
git add src/app/assessment/page.tsx
git commit -m "feat(m14): add weakMuscles/tightMuscles checklists and breathingPattern select to assessment form"
```

---

### Task 7: `weeklyVolumeByDomain` helper

**Files:**
- Modify: `src/lib/progress.ts`
- Test: `src/lib/__tests__/progress.test.ts`

**Interfaces:**
- Consumes: `WorkoutLog`, `CompletedExercise` (via `WorkoutLog.exercises`) from `@/lib/log-schemas`; `ExerciseDomain` from `@/lib/exercise-schemas`.
- Produces: `weeklyVolumeByDomain(logs: WorkoutLog[], now?: number): Record<ExerciseDomain, number>` (minutes per domain, 7-day window).

- [ ] **Step 1: Write the failing test**

Read `src/lib/__tests__/progress.test.ts` first to match its existing `log(...)`/fixture helper style, then add:

```ts
describe("weeklyVolumeByDomain", () => {
  it("returns 0 for every domain when there are no logs", () => {
    const result = weeklyVolumeByDomain([], Date.now());
    expect(result.core).toBe(0);
    expect(result.strength).toBe(0);
  });

  it("excludes logs older than 7 days", () => {
    const now = Date.now();
    const oldLog: WorkoutLog = {
      id: "1",
      userId: "u1",
      createdAt: now - 8 * 24 * 60 * 60 * 1000,
      movementFocus: "test",
      intensity: "moderate",
      estimatedMinutes: 20,
      exercises: [
        { exerciseId: "e1", name: "Ex1", domain: "core", completed: true },
      ],
    };
    const result = weeklyVolumeByDomain([oldLog], now);
    expect(result.core).toBe(0);
  });

  it("splits estimatedMinutes evenly across a log's domains", () => {
    const now = Date.now();
    const log: WorkoutLog = {
      id: "2",
      userId: "u1",
      createdAt: now,
      movementFocus: "test",
      intensity: "moderate",
      estimatedMinutes: 20,
      exercises: [
        { exerciseId: "e1", name: "Ex1", domain: "core", completed: true },
        { exerciseId: "e2", name: "Ex2", domain: "strength", completed: true },
      ],
    };
    const result = weeklyVolumeByDomain([log], now);
    expect(result.core).toBe(10);
    expect(result.strength).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/progress.test.ts -t "weeklyVolumeByDomain"`
Expected: FAIL — `weeklyVolumeByDomain` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/progress.ts`, add import at top:

```ts
import type { ExerciseDomain } from "@/lib/exercise-schemas";
```

Add at the end of the file:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/progress.test.ts -t "weeklyVolumeByDomain"`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress.ts src/lib/__tests__/progress.test.ts
git commit -m "feat(m14): add weeklyVolumeByDomain display-only progress helper"
```

---

### Task 8: Render volume-per-domain card on Progress page

**Files:**
- Modify: `src/app/progress/page.tsx`

**Interfaces:**
- Consumes: `weeklyVolumeByDomain` from Task 7.
- Produces: no new exported symbols — page UI only.

- [ ] **Step 1: Add the computed value and a domain-label map**

In `src/app/progress/page.tsx`, add to the imports (line 13-20 area):

```ts
import { weeklyVolumeByDomain } from "@/lib/progress";
```

(Add it to the existing `import { ... } from "@/lib/progress";` block instead of a new import line.)

After the existing `week` memo (line 46-49), add:

```ts
  const volumeByDomain = useMemo(
    () => weeklyVolumeByDomain(workoutLogs),
    [workoutLogs]
  );
```

Add a domain-label map near the top of the file, after `formatDate` (line 28):

```ts
const DOMAIN_LABELS: Record<string, string> = {
  breathing: "Napas",
  mobility: "Mobilitas",
  stability: "Stabilitas",
  core: "Core",
  balance: "Keseimbangan",
  strength: "Kekuatan",
  conditioning: "Kondisi",
  recovery: "Pendinginan",
};
```

- [ ] **Step 2: Render the card**

Insert a new `<Card>` right after the "Tren nyeri" card (after line 122, before the "Tes plank" card at line 124):

```tsx
        <Card>
          <CardTitle>Volume 7 hari per domain</CardTitle>
          <div className="mt-2 flex flex-col gap-1">
            {Object.entries(volumeByDomain).map(([domain, minutes]) => (
              <div
                key={domain}
                className="flex items-center justify-between text-sm text-foreground"
              >
                <span>{DOMAIN_LABELS[domain] ?? domain}</span>
                <span className="tabular text-muted-foreground">
                  {Math.round(minutes)} mnt
                </span>
              </div>
            ))}
          </div>
        </Card>
```

- [ ] **Step 3: Manually verify via dev server**

Run: `npm run dev`, navigate to `/progress`, confirm the new "Volume 7 hari per domain" card renders 8 rows with Indonesian labels and rounded minute values (0 if no recent logs, non-zero after completing a session in the last 7 days).

- [ ] **Step 4: Commit**

```bash
git add src/app/progress/page.tsx
git commit -m "feat(m14): render weekly volume-per-domain card on Progress page"
```

---

## Spec Coverage Check

- Muscle taxonomy (15 groups) → Task 1 (`muscleGroupEnum`).
- Exercise `muscles[]` tag + retag → Task 1, Task 3.
- Profile `weakMuscles`/`tightMuscles`/`breathingPattern` → Task 2.
- Onboarding form fields → Task 6.
- Engine bias in `pickForDomain` → Task 4.
- `generateSession` wiring + `breathingPattern` reasoning → Task 5.
- Volume-per-domain, display-only → Task 7, Task 8.
- Out-of-scope items (no slot-count changes, no cross-validation of weak/tight overlap, no separate profile-edit page, no engine consumption of volume signal) — none of the 8 tasks touch `slotMaxFor`, add overlap validation, add a new settings route, or feed `weeklyVolumeByDomain` into `generateSession`, consistent with the spec's "Bukan scope" section.
