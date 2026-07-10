# M8 — Decision Engine Personalization & Library Expansion

Date: 2026-07-10
Status: Approved (design)

## Goal

Make the rule-based AI Decision Engine reflect the user's assessment goals and
demonstrated fitness, balance left/right work generically, and draw from a
richer bodyweight-only library — without diagnosing, without new dependencies,
and without an IndexedDB migration.

Everything here is pure logic (`src/lib/decision-engine.ts`) and static data
(`src/lib/exercise-seed.ts`). UI and storage are untouched.

## Constraints (non-negotiable)

- **Bodyweight only.** Every exercise keeps `equipment: []`. The engine also
  filters `equipment.length === 0` so a future geared exercise can never leak in.
- **No diagnosis / no prescription per curve.** Side balancing is *generic*
  (equal left/right), never targeted at the user's specific Cobb degrees or
  concave/convex sides (`docs/04_Clinical_Guardrails.md`).
- **Safety wins.** Red-flag escalation and readiness-based intensity capping
  from the existing engine are preserved unchanged.
- **No new store, no `DB_VERSION` bump.** Progression is derived from stored
  `WorkoutLog`s, not a new persisted capability record.

## Components

### 1. `deriveGoalWeights(assessment): GoalWeights`

Pure. Scans `assessment.primaryGoals` (free text, lowercased) for keyword
groups and returns normalized weights over focus areas:

- `posture` — keywords: `postur`, `tegap`, `posture`
- `strength` — keywords: `kekuatan`, `strength`, `otot`, `kuat`
- `mobility` — keywords: `mobil`, `lentur`, `fleks`
- `pain` — keywords: `nyeri`, `sakit`, `pain`

Rules:
- Each matched group contributes weight 1.
- If nothing matches (or text is empty), fall back to the **balanced default**:
  `posture` and `strength` weighted equally, `mobility`/`pain` baseline.
- Weights are used to bias per-domain slot counts (see §4), not to add/remove
  domains — the full session sequence is always present for safety/structure.

Type:
```ts
interface GoalWeights {
  posture: number;
  strength: number;
  mobility: number;
  pain: number;
}
```

### 2. `deriveCapability(assessment, workoutLogs): Capability`

Pure. Produces the difficulty *floor* the engine may start from, so a fit user
is not locked into beginner movements.

- **Baseline floor** from `assessment.activityLevel`:
  - `sedentary` / `light` → floor `beginner` (rank 1)
  - `moderate` → floor `beginner`, eligible ceiling `intermediate`
  - `active` → floor `intermediate` (rank 2)
- **Earned bump** from recent history: inspect the most recent N (=3) workout
  logs. If all are fully completed (`exercises.every(e => e.completed)`) and
  each `postSessionPain ?? 0 <= 3`, raise the floor by one rank (max
  `advanced`). If the latest log shows `postSessionPain >= 6` or incomplete,
  drop the floor by one rank (min `beginner`).

```ts
interface Capability {
  floorRank: 1 | 2 | 3; // beginner | intermediate | advanced
}
```

### 3. Difficulty window in the engine

The daily `SessionIntensity` (from `decideIntensity`, unchanged) still sets the
**ceiling**. Capability sets the **floor**. Effective window:

```
ceilingRank = DIFFICULTY_CEILING[intensity]      // readiness-based (safety)
floorRank   = min(capability.floorRank, ceilingRank)  // never above ceiling
```

`recovery` intensity ignores the window entirely (breathing/recovery only), as
today. When `floorRank < ceilingRank`, prefer movements at or above the floor,
falling back downward only if a domain has nothing in-window.

### 4. `pickForDomain` upgrade

New signature conceptually: `pickForDomain(exercises, domain, window, weights, max)`.

1. Filter `ex.domain === domain` **and** `ex.equipment.length === 0`.
2. Apply difficulty window (floor..ceiling); if empty, relax floor toward
   beginner so a block is never silently dropped.
3. **Side balancing:** if the in-window set contains both `left` and `right`
   `sideEmphasis` variants, select matched pairs (one `left`, one `right`) of
   the same movement family before filling remaining slots with `bilateral`.
   This keeps left/right load symmetric without any curve-specific targeting.
4. `max` per domain is scaled by `weights`: posture-associated domains
   (`stability`, `breathing`) and `strength` get +1 slot when their weight is
   high; balanced default gives stability/core/strength the standard 2.

### 5. Library expansion (`exercise-seed.ts`)

Add ~15–20 graded bodyweight movements, all `equipment: []`, each with
`contraindications` and connected `progressionId`/`regressionId` chains:

- **Strength:** wall push-up → incline push-up → knee push-up → full push-up;
  split squat; reverse lunge; calf raise.
- **Posture:** wall angel; prone Y-T-W raises; chin tuck; prone press-up;
  scapular squeeze.
- **Core:** hollow-body hold (+ regression tuck hold); front plank (+ knee
  regression).

Movements are general fitness patterns, not a clinical prescription; the seed
header note and clinician-override framing are retained.

### 6. Tests (`src/lib/__tests__/decision-engine.test.ts`)

Extend existing suite:
- `deriveGoalWeights`: keyword hits, empty/no-match → balanced default.
- `deriveCapability`: activityLevel floors; bump up on 3 clean completions;
  drop on high post-session pain / incomplete.
- Difficulty window: fit user + good readiness excludes trivial beginner-only
  picks; low readiness still caps intensity.
- `pickForDomain`: excludes any `equipment.length > 0` exercise; returns
  balanced left/right pair when both exist.
- `generateSession`: red-flag escalation still short-circuits; balanced focus
  yields both posture (stability) and strength blocks within the time budget.

## Out of scope

- No curve-degree / concave-convex targeting.
- No UI changes (dashboard/workout already render `GeneratedSession`).
- No new IndexedDB store or migration.
- No progressive-overload *persistence* beyond what workout logs already store.

## Risks

- Free-text goal parsing is brittle; mitigated by the balanced default and by
  never removing safety/structure domains.
- Library growth must keep spine-safe contraindications accurate; each added
  move lists explicit skip conditions.
