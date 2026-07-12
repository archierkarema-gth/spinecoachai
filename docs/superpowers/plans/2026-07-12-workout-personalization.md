# Workout Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four workout enhancements — countdown beep, advanced-exercise surfacing, a 70/30 muscle/scoliosis preset for the owner, and a pull-up program gated on owned equipment.

**Architecture:** All engine logic stays in the pure, deterministic `src/lib/decision-engine.ts` (no network, no model). New per-user fields live on `userSchema`. The session player gains an offline Web Audio beep. Personalization is threaded through `EngineInputs` and applied in `generateSession`; the workout page passes the current user's preset and equipment.

**Tech Stack:** Next.js (app router), TypeScript, Zod, Vitest, IndexedDB (Dexie-style via `lib/db.ts`), Web Audio API.

## Global Constraints

- Bodyweight-only is the default for every user; only a user's own `ownedEquipment` allowlist unlocks geared moves. (docs/01)
- The app never diagnoses, never estimates a Cobb angle, never targets a specific curve. (docs/04)
- Safety/recovery win over performance; red-flag escalation and intensity ceilings are never weakened. (docs/04, docs/05)
- Corrective work (breathing/mobility/stability) is never dropped to zero, even under the muscle-priority preset.
- Run tests with: `npm run test -- --run` (vitest). Type-check with: `npm run build` or `npx tsc --noEmit`.
- New `userSchema` fields must be optional with Zod defaults so existing IndexedDB users parse without migration.

---

## File Structure

- `src/lib/decision-engine.ts` — MODIFY: `pickForDomain` options arg (`preferHardest`, `allowedEquipment`); `generateSession` threads preset + equipment, biases slots, hardest-first selection, reasoning.
- `src/lib/schemas.ts` — MODIFY: add `trainingPreset` and `ownedEquipment` to `userSchema`.
- `src/lib/personal-seed.ts` — MODIFY: `SEED_USER` gets preset + equipment.
- `src/lib/exercise-seed.ts` — MODIFY: append the pull-up chain.
- `src/lib/use-beep.ts` — CREATE: Web Audio beep singleton + `beepForSecond` + mute state.
- `src/components/workout/session-player.tsx` — MODIFY: beep on 5→0, mute toggle.
- `src/app/workout/page.tsx` — MODIFY: pass `user.trainingPreset` + `user.ownedEquipment` into `generateSession`.
- `src/lib/__tests__/decision-engine.test.ts` — MODIFY: update `pickForDomain` calls, seed integrity test; add new cases.
- `src/lib/__tests__/use-beep.test.ts` — CREATE: `beepForSecond` mapping.

---

## Task 1: F2 — Surface advanced exercises (hardest-first for capable users)

**Files:**
- Modify: `src/lib/decision-engine.ts`
- Test: `src/lib/__tests__/decision-engine.test.ts`

**Interfaces:**
- Produces: `pickForDomain(exercises, domain, floorRank, ceilingRank, max, opts?: PickOptions)` where `interface PickOptions { preferHardest?: boolean; allowedEquipment?: Set<string> }`. `opts` defaults to `{}`; `preferHardest` defaults `false`, `allowedEquipment` defaults to bodyweight-only.
- Produces: `generateSession` selects hardest-first when `capability.floorRank >= 2`.

- [ ] **Step 1: Write the failing test**

Add inside `describe("pickForDomain", ...)`:

```typescript
  it("prefers the hardest in-window move when preferHardest is set", () => {
    const easiestFirst = pickForDomain(EXERCISE_SEED, "strength", 1, 3, 1);
    const hardestFirst = pickForDomain(EXERCISE_SEED, "strength", 1, 3, 1, {
      preferHardest: true,
    });
    const rank = { beginner: 1, intermediate: 2, advanced: 3 } as const;
    expect(rank[hardestFirst[0].difficulty]).toBeGreaterThanOrEqual(
      rank[easiestFirst[0].difficulty]
    );
    expect(hardestFirst[0].difficulty).toBe("advanced");
  });
```

Add a new describe block:

```typescript
describe("generateSession — advanced surfacing", () => {
  it("programs an advanced move for a capable, full-readiness user", () => {
    const result = generateSession(
      inputs({
        assessment: { ...baseAssessment, activityLevel: "active" },
        checkIn: checkIn({ painLevel: 1, recovery: 5, energyLevel: 5, sleepQuality: 5 }),
        workoutLogs: [log(), log(), log()],
      })
    );
    const all = result.blocks.flatMap((b) => b.exercises);
    expect(all.some((e) => e.difficulty === "advanced")).toBe(true);
  });

  it("keeps a genuine beginner on easiest moves even at full readiness", () => {
    const result = generateSession(
      inputs({
        assessment: { ...baseAssessment, activityLevel: "sedentary" },
        checkIn: checkIn({ painLevel: 1, recovery: 5, energyLevel: 5, sleepQuality: 5 }),
      })
    );
    const all = result.blocks.flatMap((b) => b.exercises);
    expect(all.every((e) => e.difficulty !== "advanced")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/lib/__tests__/decision-engine.test.ts`
Expected: FAIL — `preferHardest` unused (hardestFirst[0] still beginner); advanced-surfacing test fails because selection is easiest-first.

- [ ] **Step 3: Add the options arg and hardest-first ordering to `pickForDomain`**

In `src/lib/decision-engine.ts`, add above `pickForDomain`:

```typescript
export interface PickOptions {
  /** Sort the in-window pool hardest-first (for capable users). */
  preferHardest?: boolean;
  /** Equipment the user owns; bodyweight (empty) is always allowed. */
  allowedEquipment?: Set<string>;
}
```

Change the signature and the two internal sorts. Replace the current filter/sort head of `pickForDomain`:

```typescript
export function pickForDomain(
  exercises: Exercise[],
  domain: ExerciseDomain,
  floorRank: number,
  ceilingRank: number,
  max: number,
  opts: PickOptions = {}
): Exercise[] {
  const allowed = opts.allowedEquipment ?? new Set<string>();
  const eligible = exercises.filter(
    (ex) =>
      ex.domain === domain &&
      ex.equipment.every((item) => allowed.has(item))
  );
  const inWindow = eligible.filter((ex) => {
    const r = DIFFICULTY_RANK[ex.difficulty];
    return r >= floorRank && r <= ceilingRank;
  });
  const pool =
    inWindow.length > 0
      ? inWindow
      : eligible.filter((ex) => DIFFICULTY_RANK[ex.difficulty] <= ceilingRank);

  const dir = opts.preferHardest ? -1 : 1;
  const byPreference = [...pool].sort(
    (a, b) => dir * (DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty])
  );

  const lefts = byPreference.filter((e) => e.sideEmphasis === "left");
  const rights = byPreference.filter((e) => e.sideEmphasis === "right");
  const result: Exercise[] = [];

  if (lefts.length > 0 && rights.length > 0 && max >= 2) {
    result.push(lefts[0], rights[0]);
  }
  for (const ex of byPreference) {
    if (result.length >= max) break;
    if (result.includes(ex)) continue;
    result.push(ex);
  }
  return result.slice(0, max);
}
```

(Note: the old local name `byEasiest` becomes `byPreference`; the bodyweight filter is now the allowlist filter — with the default empty set this is identical to `equipment.length === 0`.)

- [ ] **Step 4: Wire capability → hardest-first in `generateSession`**

In `generateSession`, after `const floorRank = Math.min(capability.floorRank, ceilingRank);` add:

```typescript
  const preferHardest = capability.floorRank >= 2;
```

In the `for (const step of sequence)` loop, change the non-recovery `pickForDomain` call to pass options:

```typescript
    const picks =
      intensity === "recovery"
        ? pickForDomain(exercises, step.domain, 1, DIFFICULTY_RANK.beginner, max)
        : pickForDomain(exercises, step.domain, floorRank, ceilingRank, max, {
            preferHardest,
          });
```

After the loop, before building `focus`, add a reasoning line when advanced was programmed:

```typescript
  if (blocks.flatMap((b) => b.exercises).some((e) => e.difficulty === "advanced")) {
    reasoning.push("Kesiapan & progres bagus — termasuk variasi tingkat lanjut.");
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- --run src/lib/__tests__/decision-engine.test.ts`
Expected: PASS (all, including the pre-existing cases — default `opts` preserves old behavior).

- [ ] **Step 6: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: surface advanced exercises for capable users (hardest-first)"
```

---

## Task 2: User profile fields — trainingPreset + ownedEquipment

**Files:**
- Modify: `src/lib/schemas.ts`
- Modify: `src/lib/personal-seed.ts`
- Test: `src/lib/__tests__/schemas.test.ts`

**Interfaces:**
- Produces: `User` gains `trainingPreset: "balanced" | "muscle-priority"` (default `"balanced"`) and `ownedEquipment: string[]` (default `[]`).
- Produces: `SEED_USER.trainingPreset === "muscle-priority"`, `SEED_USER.ownedEquipment === ["pull-up bar"]`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/schemas.test.ts`:

```typescript
import { userSchema } from "@/lib/schemas";

describe("userSchema personalization fields", () => {
  it("defaults trainingPreset to balanced and ownedEquipment to empty", () => {
    const u = userSchema.parse({
      id: "u1",
      name: "Test",
      age: 30,
      createdAt: 0,
    });
    expect(u.trainingPreset).toBe("balanced");
    expect(u.ownedEquipment).toEqual([]);
  });

  it("accepts muscle-priority and an equipment list", () => {
    const u = userSchema.parse({
      id: "u1",
      name: "Test",
      age: 30,
      createdAt: 0,
      trainingPreset: "muscle-priority",
      ownedEquipment: ["pull-up bar"],
    });
    expect(u.trainingPreset).toBe("muscle-priority");
    expect(u.ownedEquipment).toEqual(["pull-up bar"]);
  });
});
```

(If `src/lib/__tests__/schemas.test.ts` has no `describe`/`import` for vitest yet, add `import { describe, expect, it } from "vitest";` at the top if missing.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/__tests__/schemas.test.ts`
Expected: FAIL — `u.trainingPreset` is `undefined`.

- [ ] **Step 3: Add the fields to `userSchema`**

In `src/lib/schemas.ts`, replace the `userSchema` definition:

```typescript
export const trainingPresetEnum = z.enum(["balanced", "muscle-priority"]);
export type TrainingPreset = z.infer<typeof trainingPresetEnum>;

export const userSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nama wajib diisi"),
  age: z.number().int().min(13).max(100),
  createdAt: z.number(),
  // Personalization (optional with defaults so existing records parse).
  trainingPreset: trainingPresetEnum.default("balanced"),
  ownedEquipment: z.array(z.string()).default([]),
});
export type User = z.infer<typeof userSchema>;
```

- [ ] **Step 4: Seed the owner's values**

In `src/lib/personal-seed.ts`, update `SEED_USER`:

```typescript
export const SEED_USER: Omit<User, "createdAt"> = {
  id: SEED_USER_ID,
  name: "Archie",
  age: 32,
  trainingPreset: "muscle-priority",
  ownedEquipment: ["pull-up bar"],
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- --run src/lib/__tests__/schemas.test.ts`
Expected: PASS. Then type-check: `npx tsc --noEmit` — Expected: no errors (SEED_USER now matches `User`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas.ts src/lib/personal-seed.ts src/lib/__tests__/schemas.test.ts
git commit -m "feat: add trainingPreset and ownedEquipment user fields"
```

---

## Task 3: F4 — Pull-up program via equipment allowlist

**Files:**
- Modify: `src/lib/exercise-seed.ts`
- Modify: `src/lib/decision-engine.ts`
- Test: `src/lib/__tests__/decision-engine.test.ts`

**Interfaces:**
- Consumes: `PickOptions.allowedEquipment` (Task 1), `User.ownedEquipment` (Task 2).
- Produces: `EngineInputs` gains `ownedEquipment?: string[]` (default `[]`). `generateSession` builds `allowedEquipment = new Set(inputs.ownedEquipment ?? [])` and passes it to every `pickForDomain` call.
- Produces: four new `strength` exercises with `equipment: ["pull-up bar"]` and ids `ex-dead-hang`, `ex-scapular-pull`, `ex-negative-pullup`, `ex-full-pullup`.

- [ ] **Step 1: Write the failing test**

Update the existing seed-integrity test (it currently asserts "entirely bodyweight", which the pull-up chain breaks). Replace that `it` block with an allowlist-aware version, and add engine cases:

```typescript
  it("bodyweight moves have no equipment; geared moves list only known equipment", () => {
    const known = new Set(["pull-up bar"]);
    for (const ex of EXERCISE_SEED) {
      expect(ex.equipment.every((item) => known.has(item))).toBe(true);
    }
  });
```

Add a new describe block:

```typescript
describe("generateSession — equipment allowlist", () => {
  const readyActive = {
    assessment: {
      ...baseAssessment,
      activityLevel: "active" as const,
      availableMinutesPerDay: 90,
    },
    checkIn: checkIn({
      painLevel: 1,
      recovery: 5,
      energyLevel: 5,
      sleepQuality: 5,
      availableMinutes: 90,
    }),
    workoutLogs: [log(), log(), log()],
  };

  it("hides pull-up moves when the user owns no equipment", () => {
    const result = generateSession(inputs(readyActive));
    const all = result.blocks.flatMap((b) => b.exercises);
    expect(all.some((e) => e.equipment.includes("pull-up bar"))).toBe(false);
  });

  it("includes pull-up moves when the user owns a bar", () => {
    const result = generateSession(
      inputs({ ...readyActive, ownedEquipment: ["pull-up bar"] })
    );
    const all = result.blocks.flatMap((b) => b.exercises);
    expect(all.some((e) => e.equipment.includes("pull-up bar"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/lib/__tests__/decision-engine.test.ts`
Expected: FAIL — `ownedEquipment` not on `EngineInputs` (type error) / pull-up seed absent.

- [ ] **Step 3: Append the pull-up chain to `EXERCISE_SEED`**

Add before the closing `];` of `EXERCISE_SEED` in `src/lib/exercise-seed.ts`:

```typescript
  // Pull-up progression — requires a pull-up bar (gated by ownedEquipment).
  {
    id: "ex-dead-hang",
    name: "Dead Hang",
    domain: "strength",
    difficulty: "beginner",
    durationSeconds: 30,
    equipment: ["pull-up bar"],
    sideEmphasis: "bilateral",
    cues: ["Gantung lengan lurus, bahu aktif", "Napas teratur, badan rileks"],
    contraindications: ["Nyeri bahu saat menggantung", "Kesemutan/menjalar ke tangan"],
    progressionId: "ex-scapular-pull",
    regressionId: null,
    videoUrl: null,
  },
  {
    id: "ex-scapular-pull",
    name: "Scapular Pull",
    domain: "strength",
    difficulty: "intermediate",
    durationSeconds: 40,
    equipment: ["pull-up bar"],
    sideEmphasis: "bilateral",
    cues: ["Dari gantung, tarik tulang belikat ke bawah", "Siku tetap lurus"],
    contraindications: ["Nyeri bahu saat menarik", "Kesemutan/menjalar ke tangan"],
    progressionId: "ex-negative-pullup",
    regressionId: "ex-dead-hang",
    videoUrl: null,
  },
  {
    id: "ex-negative-pullup",
    name: "Negative Pull-up",
    domain: "strength",
    difficulty: "advanced",
    durationSeconds: 45,
    equipment: ["pull-up bar"],
    sideEmphasis: "bilateral",
    cues: ["Mulai dari atas bar", "Turun perlahan 3–5 detik terkontrol"],
    contraindications: ["Nyeri bahu/siku saat menahan", "Kesemutan/menjalar ke tangan"],
    progressionId: "ex-full-pullup",
    regressionId: "ex-scapular-pull",
    videoUrl: null,
  },
  {
    id: "ex-full-pullup",
    name: "Full Pull-up",
    domain: "strength",
    difficulty: "advanced",
    durationSeconds: 45,
    equipment: ["pull-up bar"],
    sideEmphasis: "bilateral",
    cues: ["Tarik sampai dagu di atas bar", "Turun penuh terkontrol"],
    contraindications: ["Nyeri bahu/siku saat menarik", "Kesemutan/menjalar ke tangan"],
    progressionId: null,
    regressionId: "ex-negative-pullup",
    videoUrl: null,
  },
```

- [ ] **Step 4: Thread `ownedEquipment` through `generateSession`**

In `src/lib/decision-engine.ts`, add to the `EngineInputs` interface:

```typescript
  /** Equipment the user owns; unlocks geared moves. Defaults to []. */
  ownedEquipment?: string[];
```

In `generateSession`, after `const weights = deriveGoalWeights(assessment);` add:

```typescript
  const allowedEquipment = new Set(inputs.ownedEquipment ?? []);
```

Update BOTH `pickForDomain` calls in the loop to pass `allowedEquipment`:

```typescript
    const picks =
      intensity === "recovery"
        ? pickForDomain(exercises, step.domain, 1, DIFFICULTY_RANK.beginner, max, {
            allowedEquipment,
          })
        : pickForDomain(exercises, step.domain, floorRank, ceilingRank, max, {
            preferHardest,
            allowedEquipment,
          });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- --run src/lib/__tests__/decision-engine.test.ts`
Expected: PASS (including the updated integrity test and the "unique ids / resolvable links" test — the new chain links resolve).

- [ ] **Step 6: Commit**

```bash
git add src/lib/exercise-seed.ts src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: pull-up program gated by owned-equipment allowlist"
```

---

## Task 4: F3 — 70/30 muscle/scoliosis preset in the engine

**Files:**
- Modify: `src/lib/decision-engine.ts`
- Test: `src/lib/__tests__/decision-engine.test.ts`

**Interfaces:**
- Consumes: `User.trainingPreset` (Task 2), muscle/corrective domain groups.
- Produces: `EngineInputs` gains `preset?: "balanced" | "muscle-priority"` (default `"balanced"`). `generateSession` biases per-domain slot counts under `muscle-priority`, keeping every corrective domain ≥ 1 slot.

- [ ] **Step 1: Write the failing test**

Add a describe block:

```typescript
describe("generateSession — muscle-priority preset", () => {
  const longReady = {
    assessment: {
      ...baseAssessment,
      activityLevel: "active" as const,
      availableMinutesPerDay: 90,
    },
    checkIn: checkIn({
      painLevel: 1,
      recovery: 5,
      energyLevel: 5,
      sleepQuality: 5,
      availableMinutes: 90,
    }),
    workoutLogs: [log(), log(), log()],
  };

  const MUSCLE = new Set(["strength", "conditioning"]);
  const CORRECTIVE = new Set(["breathing", "mobility", "stability"]);

  function timeByGroup(blocks: { domain: string; exercises: { durationSeconds: number }[] }[]) {
    let muscle = 0;
    let corrective = 0;
    for (const b of blocks) {
      const t = b.exercises.reduce((s, e) => s + e.durationSeconds, 0);
      if (MUSCLE.has(b.domain)) muscle += t;
      else if (CORRECTIVE.has(b.domain)) corrective += t;
    }
    return { muscle, corrective };
  }

  it("weights muscle time above corrective time under muscle-priority", () => {
    const balanced = generateSession(inputs({ ...longReady, preset: "balanced" }));
    const priority = generateSession(inputs({ ...longReady, preset: "muscle-priority" }));
    const b = timeByGroup(balanced.blocks);
    const p = timeByGroup(priority.blocks);
    const balancedShare = b.muscle / (b.muscle + b.corrective);
    const priorityShare = p.muscle / (p.muscle + p.corrective);
    expect(priorityShare).toBeGreaterThan(balancedShare);
    expect(priorityShare).toBeGreaterThan(0.55);
  });

  it("never drops corrective work to zero under muscle-priority", () => {
    const priority = generateSession(inputs({ ...longReady, preset: "muscle-priority" }));
    const p = timeByGroup(priority.blocks);
    expect(p.corrective).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/lib/__tests__/decision-engine.test.ts`
Expected: FAIL — `preset` not on `EngineInputs` (type error) / no muscle bias.

- [ ] **Step 3: Add preset + slot biasing to the engine**

In `src/lib/decision-engine.ts`, add to `EngineInputs`:

```typescript
  /** Owner-only session mix preset. Defaults to "balanced". */
  preset?: "balanced" | "muscle-priority";
```

Add near the domain-sequence constants:

```typescript
const MUSCLE_DOMAINS = new Set<ExerciseDomain>(["strength", "conditioning"]);
const CORRECTIVE_DOMAINS = new Set<ExerciseDomain>([
  "breathing",
  "mobility",
  "stability",
]);

/**
 * Per-domain slot count. Under "muscle-priority" the muscle domains get more
 * slots and corrective domains are trimmed to a single slot each — pushing the
 * session-time mix toward ~70/30 while never zeroing corrective work. The time
 * budget still caps total volume.
 */
function slotMaxFor(
  domain: ExerciseDomain,
  intensity: SessionIntensity,
  preset: "balanced" | "muscle-priority",
  boosted: boolean
): number {
  if (intensity === "recovery") return 2;
  if (preset === "muscle-priority") {
    if (MUSCLE_DOMAINS.has(domain)) return 4;
    if (CORRECTIVE_DOMAINS.has(domain)) return 1;
    return 1; // core/balance/recovery: keep light so muscle dominates
  }
  return boosted ? 3 : 2;
}
```

In `generateSession`, read the preset near the other derived values:

```typescript
  const preset = inputs.preset ?? "balanced";
```

Replace the `const max = ...` line inside the loop with:

```typescript
    const max = slotMaxFor(step.domain, intensity, preset, boosted);
```

After the advanced-surfacing reasoning line added in Task 1, add:

```typescript
  if (preset === "muscle-priority") {
    reasoning.push("Preset kamu: fokus utama pembentukan otot, tetap sisipkan korektif skoliosis.");
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- --run src/lib/__tests__/decision-engine.test.ts`
Expected: PASS (all cases, including earlier tasks — `balanced` path is unchanged since `slotMaxFor` returns the old `boosted ? 3 : 2`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: 70/30 muscle-priority session preset"
```

---

## Task 5: Wire the workout page to pass preset + equipment

**Files:**
- Modify: `src/app/workout/page.tsx`

**Interfaces:**
- Consumes: `EngineInputs.preset` (Task 4), `EngineInputs.ownedEquipment` (Task 3), `user.trainingPreset` / `user.ownedEquipment` (Task 2).

- [ ] **Step 1: Pass the user's preset and equipment into `generateSession`**

In `src/app/workout/page.tsx`, the `session` memo currently omits preset/equipment. Update the `generateSession({ ... })` call to include:

```typescript
    return generateSession({
      assessment: latestAssessment,
      checkIn: latestCheckIn,
      exercises,
      recentSessionTimestamps: workoutLogs.map((l) => l.createdAt),
      workoutLogs,
      preset: user?.trainingPreset ?? "balanced",
      ownedEquipment: user?.ownedEquipment ?? [],
    });
```

Add `user` to the memo dependency array:

```typescript
  }, [latestAssessment, latestCheckIn, exercises, workoutLogs, user]);
```

- [ ] **Step 2: Type-check and run the full suite**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run test -- --run`
Expected: PASS (all files).

- [ ] **Step 3: Verify in the browser (evidence before completion)**

Start the dev server via the Browser pane (`preview_start {name:"dev"}`), navigate to `/checkin`, submit a check-in with high readiness, then `/workout`. Confirm the session card lists a pull-up move (the seed owner has a bar) and the reasoning includes the muscle-priority line. Capture a screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/app/workout/page.tsx
git commit -m "feat: apply user preset and owned-equipment to generated sessions"
```

---

## Task 6: F1 — Countdown beep (5→0)

**Files:**
- Create: `src/lib/use-beep.ts`
- Create: `src/lib/__tests__/use-beep.test.ts`
- Modify: `src/components/workout/session-player.tsx`

**Interfaces:**
- Produces: `beepForSecond(remaining: number): "tick" | "final" | null` — `5..1 → "tick"`, `0 → "final"`, else `null`.
- Produces: `playCue(cue: "tick" | "final"): void` (no-op if muted or no AudioContext), `isBeepMuted(): boolean`, `setBeepMuted(muted: boolean): void`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/use-beep.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { beepForSecond } from "@/lib/use-beep";

describe("beepForSecond", () => {
  it("ticks for 5 down to 1", () => {
    for (const n of [5, 4, 3, 2, 1]) {
      expect(beepForSecond(n)).toBe("tick");
    }
  });

  it("plays the final tone at 0", () => {
    expect(beepForSecond(0)).toBe("final");
  });

  it("is silent above 5 and below 0", () => {
    expect(beepForSecond(6)).toBeNull();
    expect(beepForSecond(-1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/__tests__/use-beep.test.ts`
Expected: FAIL — module not found / `beepForSecond` undefined.

- [ ] **Step 3: Create `src/lib/use-beep.ts`**

```typescript
"use client";

/**
 * Offline countdown audio for the session player. Tones are synthesized with a
 * Web Audio oscillator — no asset files, works fully offline. The AudioContext
 * is created lazily on first playback (which happens after a user gesture, so
 * autoplay policy never blocks it). Mute state persists in localStorage.
 */

const MUTE_KEY = "spinecoach_beep_muted";

export type BeepCue = "tick" | "final";

/** Which cue to play for a given remaining-seconds value (pure, testable). */
export function beepForSecond(remaining: number): BeepCue | null {
  if (remaining === 0) return "final";
  if (remaining >= 1 && remaining <= 5) return "tick";
  return null;
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isBeepMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setBeepMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

/** Play a short cue. No-op when muted or Web Audio is unavailable. */
export function playCue(cue: BeepCue): void {
  if (isBeepMuted()) return;
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  const freq = cue === "final" ? 1320 : 880;
  const dur = cue === "final" ? 0.25 : 0.08;
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + dur);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/__tests__/use-beep.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the beep + mute toggle into the session player**

In `src/components/workout/session-player.tsx`:

Add imports:

```typescript
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipForward, Check, X, Volume2, VolumeX } from "lucide-react";
import { beepForSecond, playCue, isBeepMuted, setBeepMuted } from "@/lib/use-beep";
```

Inside the component, add state + the beep effect (place after the existing `timer` line):

```typescript
  const [muted, setMuted] = useState(false);
  useEffect(() => setMuted(isBeepMuted()), []);
  const lastBeepedSecond = useRef<number | null>(null);

  useEffect(() => {
    if (!timer.running) {
      lastBeepedSecond.current = null;
      return;
    }
    if (lastBeepedSecond.current === timer.remaining) return;
    lastBeepedSecond.current = timer.remaining;
    const cue = beepForSecond(timer.remaining);
    if (cue) playCue(cue);
  }, [timer.running, timer.remaining]);
```

Add a mute toggle button to the header row. Replace the existing header `<div className="flex items-center justify-between">…</div>` block (the one with the step counter and "Keluar") with:

```typescript
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {Math.min(doneExerciseSteps + 1, totalExerciseSteps)} / {totalExerciseSteps}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={muted ? "Bunyikan hitung mundur" : "Bisukan hitung mundur"}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setBeepMuted(next);
            }}
            className="text-muted-foreground"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="text-xs font-semibold text-muted-foreground"
          >
            Keluar
          </button>
        </div>
      </div>
```

- [ ] **Step 6: Type-check, lint, run full suite**

Run: `npx tsc --noEmit` — Expected: no errors.
Run: `npm run lint` — Expected: no errors (the beep effect deps are complete; no eslint-disable needed).
Run: `npm run test -- --run` — Expected: PASS (all files).

- [ ] **Step 7: Verify in the browser**

With the dev server running, start a session and confirm (via `read_console_messages` for no errors, and by observing) the last five seconds tick and the mute toggle flips the icon. Capture a screenshot.

- [ ] **Step 8: Commit**

```bash
git add src/lib/use-beep.ts src/lib/__tests__/use-beep.test.ts src/components/workout/session-player.tsx
git commit -m "feat: countdown beep for final 5 seconds with mute toggle"
```

---

## Self-Review

**Spec coverage:**
- F1 beep 5→0 → Task 6. ✓
- F2 surface advanced (hardest-first, floor≥2, ceiling untouched) → Task 1. ✓
- F3 muscle-priority 70/30, corrective ≥1 → Tasks 2 (field), 4 (engine), 5 (wiring). ✓
- F4 pull-up chain + equipment allowlist → Tasks 2 (field), 3 (seed + engine), 5 (wiring). ✓
- Migration via optional/defaulted fields → Task 2. ✓
- Tests for each → Tasks 1,2,3,4,6. ✓

**Placeholder scan:** none — every code step shows full code.

**Type consistency:** `PickOptions` (preferHardest, allowedEquipment) defined Task 1, used Tasks 1/3. `EngineInputs` gains `ownedEquipment` (Task 3) and `preset` (Task 4), both consumed in Task 5. `trainingPreset`/`ownedEquipment` on `User` (Task 2) match `SEED_USER` and page wiring. `beepForSecond`/`playCue`/`isBeepMuted`/`setBeepMuted` defined Task 6, used same task. Domain groups `MUSCLE_DOMAINS`/`CORRECTIVE_DOMAINS` match the test's `MUSCLE`/`CORRECTIVE` sets.

**Ordering note:** Task 1 introduces `PickOptions` with both fields up front; Task 3 uses `allowedEquipment`, so no signature is touched twice.
