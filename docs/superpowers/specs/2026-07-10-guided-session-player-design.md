# M-Workout — Guided Session Player

Date: 2026-07-10
Status: Approved (design)

## Goal

Turn the daily workout from a static list into a guided, timed session the user
can actually perform: exercise-by-exercise, with per-phase timers, rest breaks,
accurate per-exercise completion, and a post-session pain capture that feeds the
capability engine and pain trend.

No new dependency, no IndexedDB migration (`WorkoutLog.postSessionPain` already
exists in the schema).

## Constraints (non-negotiable)

- **Hybrid timing.** Each exercise phase runs a countdown from
  `durationSeconds`; when it reaches 0 it stops and signals but does NOT
  auto-advance — the user taps "Lanjut". Pause and "Lewati" (skip) are always
  available.
- **Bilateral auto-split.** An exercise with `sideEmphasis: "bilateral"` becomes
  two phases (kiri, then kanan), each of `durationSeconds`. `left`/`right`
  exercises are already separate seed entries and stay one phase each.
- **Rest between exercise phases only.** A fixed 20s rest is inserted between
  consecutive exercise phases, never before the first or after the last. Rest is
  skippable.
- **Accurate completion.** An exercise is `completed: true` if at least one of
  its phases was advanced with "Lanjut"; if every phase of an exercise was
  skipped, it is `completed: false`.
- **Post-session pain.** Before the log is written, capture a 0–10
  `postSessionPain`. This is required — it is what lets `deriveCapability` drop
  difficulty on a bad day (`docs/05`).
- **Guardrails.** The "not a substitute for a doctor" disclaimer stays visible;
  no diagnosis, no Cobb claims.
- Engine and log-writing behaviour otherwise unchanged; the player is additive.

## Components

### 1. `src/lib/session-player.ts` (pure, unit-tested)

The step model and the two pure transforms. No React, no timers.

```ts
import type { Exercise } from "@/lib/exercise-schemas";
import type { CompletedExercise } from "@/lib/log-schemas";
import type { GeneratedSession } from "@/lib/decision-engine";

export const REST_SECONDS = 20;

export type Step =
  | {
      kind: "exercise";
      exercise: Exercise;
      side?: "left" | "right"; // set only for auto-split bilateral phases
      seconds: number;
      phaseId: string; // unique per phase, e.g. `${exercise.id}` or `${exercise.id}:left`
    }
  | { kind: "rest"; seconds: number };

export type PhaseStatus = "done" | "skipped";
```

**`buildSteps(session: GeneratedSession): Step[]`**
- Flatten `session.blocks[].exercises[]` in order.
- For each exercise: if `sideEmphasis === "bilateral"`, emit two exercise steps
  with `side: "left"` (phaseId `${id}:left`) then `side: "right"`
  (phaseId `${id}:right`), each `seconds = durationSeconds`. Otherwise emit one
  exercise step (phaseId `${id}`), no `side`, `seconds = durationSeconds`.
- Insert one `{ kind: "rest", seconds: REST_SECONDS }` between every pair of
  consecutive exercise steps — including between the two sides of a bilateral
  exercise. No rest before the first exercise step or after the last.

**`toCompletedExercises(session: GeneratedSession, statuses: Record<string, PhaseStatus>): CompletedExercise[]`**
- One `CompletedExercise` per distinct exercise in the session, preserving order.
- `completed = true` iff at least one of that exercise's phaseIds has status
  `"done"`. A phaseId absent from `statuses` counts as not done.
- Fields: `{ exerciseId: ex.id, name: ex.name, domain: ex.domain, completed }`.

### 2. `src/lib/use-countdown.ts` — `useCountdown` hook

Small client hook driving a per-phase countdown.

- Signature: `useCountdown(seconds: number, opts?: { autoStart?: boolean })` →
  `{ remaining: number; running: boolean; done: boolean; start(): void; pause(): void; reset(seconds: number): void }`.
- Ticks once per second via `setInterval`, cleared on unmount and on reaching 0.
- `done` becomes true at 0; it never auto-advances (the component decides).

### 3. `src/components/workout/session-player.tsx` (client)

Props: `{ session: GeneratedSession; onFinish(result: { completed: CompletedExercise[]; postSessionPain: number }): void; onExit(): void }`.

Internal machine: `phaseIndex` over `buildSteps(session)`, a `statuses` map, and
a terminal `summary` view.

- **Exercise step:** shows name, side label (Kiri/Kanan when `side` set, else
  the exercise's `SIDE_LABEL`), cues, and the countdown (`useCountdown`,
  autoStart). Controls: **Pause/Lanjutkan**, **Lewati** (sets status `skipped`,
  advance), **Lanjut** (sets status `done`, advance). "Lanjut" is enabled the
  whole time (user may finish early); at 0 the timer just stops and the button
  is emphasized.
- **Rest step:** 20s countdown (autoStart) + **Lewati**; auto-advances to the
  next exercise when it hits 0.
- **Progress:** a bar of `exercise-step-index / total-exercise-steps` (rest
  steps excluded from the count shown).
- **Summary:** after the last step, render a 0–10 `ScalePicker` for
  "Nyeri setelah sesi" and a **Simpan sesi** button that calls `onFinish` with
  `toCompletedExercises(session, statuses)` and the picked pain.
- Disclaimer line stays visible in the player and summary.

### 4. `src/app/workout/page.tsx` (modify)

- Add a view state: `"overview" | "playing"`.
- Overview keeps the current blocks/reasoning display plus a primary
  **Mulai sesi** button (replaces the bare "Selesaikan sesi").
- **Mulai sesi** → `playing`, render `<SessionPlayer session={session} .../>`.
- `onFinish({ completed, postSessionPain })`: write the `WorkoutLog` using the
  real `completed` array and `postSessionPain` (instead of marking everything
  complete), `await refreshLogs()`, `router.push("/progress")`.
- `onExit`: return to `overview` without writing a log.
- The escalated / no-checkin / no-assessment branches are unchanged.

## Tests (`src/lib/__tests__/session-player.test.ts`)

- `buildSteps`:
  - a bilateral exercise yields two exercise steps with `side` left then right
    and matching `seconds`;
  - a `left`/`right` exercise yields one step each, no auto-split;
  - rest steps appear between consecutive exercise steps and never at the ends;
  - total exercise-step count equals sum over exercises of (bilateral ? 2 : 1).
- `toCompletedExercises`:
  - all phases done → every exercise `completed: true`;
  - all phases skipped → every exercise `completed: false`;
  - a bilateral exercise with one side done + one skipped → `completed: true`;
  - one `CompletedExercise` per distinct exercise, order preserved.

Timer and UI behaviour are verified in the running app (browser), not unit
tested.

## Out of scope

- No exercise videos (all `videoUrl` are null).
- No configurable rest length (fixed 20s this version).
- No audio/vibration cues beyond a visual timer-done state.
- No changes to the decision engine or seed data.

## Risks

- Timer drift / cleanup: `useCountdown` must clear its interval on unmount and
  phase change to avoid leaks — covered by the hook's contract, verified in app.
- Bilateral doubling makes actual session time exceed the engine's
  `estimatedMinutes` (a planning estimate); acceptable — the log records actual
  completion, and the estimate is labelled "±".
