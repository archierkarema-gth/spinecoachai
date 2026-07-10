# Guided Session Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the daily workout a guided, timed, exercise-by-exercise session with rest breaks, accurate per-exercise completion, and post-session pain capture.

**Architecture:** A pure step-model library (`session-player.ts`) and a countdown hook feed a client `SessionPlayer` component rendered in-page from `/workout` behind an overview→playing state. On finish it writes a real `WorkoutLog` (actual completion + `postSessionPain`).

**Tech Stack:** TypeScript, React (Next.js App Router, client components), Vitest (with fake timers for the hook).

## Global Constraints

- Hybrid timing: countdown per exercise phase; at 0 it stops and signals but does NOT auto-advance — user taps "Lanjut". Pause and "Lewati" always available.
- Bilateral auto-split: `sideEmphasis: "bilateral"` → two phases (kiri, then kanan), each `durationSeconds`. `left`/`right` stay one phase each.
- Rest = fixed 20s between consecutive exercise phases only (never at the ends); skippable; auto-advances at 0.
- Completion: exercise `completed: true` iff ≥1 of its phases was advanced with "Lanjut"; all-skipped → false.
- Post-session pain 0–10 captured before writing the log (feeds `deriveCapability`).
- "Not a substitute for a doctor" disclaimer stays visible; no diagnosis/Cobb claims.
- No new dependency; no IndexedDB migration (`postSessionPain` already in schema).
- Indonesian UI copy, matching existing pages.

---

### Task 1: Pure step-model library

**Files:**
- Create: `src/lib/session-player.ts`
- Test: `src/lib/__tests__/session-player.test.ts`

**Interfaces:**
- Consumes: `Exercise` (`@/lib/exercise-schemas`), `CompletedExercise` (`@/lib/log-schemas`), `GeneratedSession` (`@/lib/decision-engine`).
- Produces: `REST_SECONDS`, `type Step`, `type PhaseStatus`, `buildSteps(session): Step[]`, `toCompletedExercises(session, statuses): CompletedExercise[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/session-player.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSteps, toCompletedExercises, REST_SECONDS } from "@/lib/session-player";
import type { GeneratedSession } from "@/lib/decision-engine";
import type { Exercise } from "@/lib/exercise-schemas";

function ex(id: string, side: Exercise["sideEmphasis"], seconds = 60): Exercise {
  return {
    id,
    name: id,
    domain: "strength",
    difficulty: "beginner",
    durationSeconds: seconds,
    equipment: [],
    sideEmphasis: side,
    cues: [],
    contraindications: [],
    progressionId: null,
    regressionId: null,
    videoUrl: null,
  };
}

function session(exercises: Exercise[]): GeneratedSession {
  return {
    movementFocus: "x",
    intensity: "moderate",
    blocks: [{ domain: "strength", label: "Kekuatan", exercises }],
    estimatedMinutes: 10,
    reasoning: [],
    escalated: false,
  };
}

describe("buildSteps", () => {
  it("splits a bilateral exercise into left then right phases", () => {
    const steps = buildSteps(session([ex("a", "bilateral", 30)]));
    const exSteps = steps.filter((s) => s.kind === "exercise");
    expect(exSteps).toHaveLength(2);
    expect(exSteps[0]).toMatchObject({ side: "left", seconds: 30, phaseId: "a:left" });
    expect(exSteps[1]).toMatchObject({ side: "right", seconds: 30, phaseId: "a:right" });
  });

  it("keeps a one-sided exercise as a single phase with no side", () => {
    const steps = buildSteps(session([ex("l", "left")]));
    const exSteps = steps.filter((s) => s.kind === "exercise");
    expect(exSteps).toHaveLength(1);
    expect(exSteps[0]).toMatchObject({ phaseId: "l" });
    expect((exSteps[0] as { side?: string }).side).toBeUndefined();
  });

  it("inserts rest between exercise phases but not at the ends", () => {
    const steps = buildSteps(session([ex("a", "left"), ex("b", "left")]));
    expect(steps[0].kind).toBe("exercise");
    expect(steps[1]).toEqual({ kind: "rest", seconds: REST_SECONDS });
    expect(steps[2].kind).toBe("exercise");
    expect(steps).toHaveLength(3);
  });

  it("counts two exercise steps for a bilateral move, one for each single side", () => {
    const steps = buildSteps(session([ex("a", "bilateral"), ex("l", "left")]));
    expect(steps.filter((s) => s.kind === "exercise")).toHaveLength(3);
  });
});

describe("toCompletedExercises", () => {
  const s = session([ex("a", "bilateral"), ex("b", "left")]);

  it("marks all completed when every phase is done", () => {
    const result = toCompletedExercises(s, { "a:left": "done", "a:right": "done", b: "done" });
    expect(result.map((r) => r.completed)).toEqual([true, true]);
    expect(result.map((r) => r.exerciseId)).toEqual(["a", "b"]);
  });

  it("marks not completed when all phases skipped", () => {
    const result = toCompletedExercises(s, { "a:left": "skipped", "a:right": "skipped", b: "skipped" });
    expect(result.every((r) => !r.completed)).toBe(true);
  });

  it("marks a bilateral exercise completed if one side is done", () => {
    const result = toCompletedExercises(s, { "a:left": "done", "a:right": "skipped", b: "skipped" });
    expect(result.find((r) => r.exerciseId === "a")!.completed).toBe(true);
    expect(result.find((r) => r.exerciseId === "b")!.completed).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/session-player.test.ts`
Expected: FAIL — module `@/lib/session-player` not found.

- [ ] **Step 3: Implement the library**

Create `src/lib/session-player.ts`:

```ts
import type { Exercise } from "@/lib/exercise-schemas";
import type { CompletedExercise } from "@/lib/log-schemas";
import type { GeneratedSession } from "@/lib/decision-engine";

/** Fixed rest inserted between consecutive exercise phases (docs spec). */
export const REST_SECONDS = 20;

export type Step =
  | {
      kind: "exercise";
      exercise: Exercise;
      side?: "left" | "right";
      seconds: number;
      phaseId: string;
    }
  | { kind: "rest"; seconds: number };

export type PhaseStatus = "done" | "skipped";

/**
 * Flatten a generated session into an ordered list of timed steps. Bilateral
 * exercises are auto-split into a left then a right phase; single-sided
 * exercises stay one phase. A 20s rest is placed between consecutive exercise
 * phases only — never before the first or after the last.
 */
export function buildSteps(session: GeneratedSession): Step[] {
  const exerciseSteps: Step[] = [];
  for (const block of session.blocks) {
    for (const exercise of block.exercises) {
      if (exercise.sideEmphasis === "bilateral") {
        exerciseSteps.push({
          kind: "exercise",
          exercise,
          side: "left",
          seconds: exercise.durationSeconds,
          phaseId: `${exercise.id}:left`,
        });
        exerciseSteps.push({
          kind: "exercise",
          exercise,
          side: "right",
          seconds: exercise.durationSeconds,
          phaseId: `${exercise.id}:right`,
        });
      } else {
        exerciseSteps.push({
          kind: "exercise",
          exercise,
          seconds: exercise.durationSeconds,
          phaseId: exercise.id,
        });
      }
    }
  }

  const steps: Step[] = [];
  exerciseSteps.forEach((step, i) => {
    if (i > 0) steps.push({ kind: "rest", seconds: REST_SECONDS });
    steps.push(step);
  });
  return steps;
}

/**
 * Aggregate per-phase statuses into one CompletedExercise per distinct
 * exercise, order preserved. An exercise counts as completed if at least one
 * of its phases was advanced ("done"); an absent phase counts as not done.
 */
export function toCompletedExercises(
  session: GeneratedSession,
  statuses: Record<string, PhaseStatus>
): CompletedExercise[] {
  const seen = new Set<string>();
  const result: CompletedExercise[] = [];
  for (const block of session.blocks) {
    for (const ex of block.exercises) {
      if (seen.has(ex.id)) continue;
      seen.add(ex.id);
      const phaseIds =
        ex.sideEmphasis === "bilateral"
          ? [`${ex.id}:left`, `${ex.id}:right`]
          : [ex.id];
      const completed = phaseIds.some((p) => statuses[p] === "done");
      result.push({
        exerciseId: ex.id,
        name: ex.name,
        domain: ex.domain,
        completed,
      });
    }
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/session-player.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/session-player.ts src/lib/__tests__/session-player.test.ts
git commit -m "feat: pure step-model for guided session player"
```

---

### Task 2: `useCountdown` hook

**Files:**
- Create: `src/lib/use-countdown.ts`

No unit test: the project has no React hook test renderer and a new dependency
is disallowed by the Global Constraints. The hook's behaviour (tick, pause,
reset, done-at-zero) is verified in the running app in Task 4.

**Interfaces:**
- Produces: `useCountdown(seconds: number, opts?: { autoStart?: boolean }): { remaining: number; running: boolean; done: boolean; start(): void; pause(): void; reset(seconds: number): void }`.

- [ ] **Step 1: Implement the hook**

Create `src/lib/use-countdown.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Simple 1-second-tick countdown. Never auto-advances anything — reaching 0
 * only flips `done`; the caller decides what happens next (hybrid timing).
 */
export function useCountdown(
  seconds: number,
  opts: { autoStart?: boolean } = {}
) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(opts.autoStart ?? false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clear();
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return clear;
  }, [running, clear]);

  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => {
    clear();
    setRunning(false);
  }, [clear]);
  const reset = useCallback(
    (next: number) => {
      clear();
      setRemaining(next);
      setRunning(true);
    },
    [clear]
  );

  return { remaining, running, done: remaining === 0, start, pause, reset };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/use-countdown.ts
git commit -m "feat: useCountdown hook for session timers"
```

---

### Task 3: `SessionPlayer` component

**Files:**
- Create: `src/components/workout/session-player.tsx`
- (No unit test — timer/UI behaviour verified in the running app in Task 4.)

**Interfaces:**
- Consumes: `buildSteps`, `toCompletedExercises`, `type PhaseStatus` (`@/lib/session-player`); `useCountdown` (`@/lib/use-countdown`); `GeneratedSession` (`@/lib/decision-engine`); `CompletedExercise` (`@/lib/log-schemas`); `ScalePicker` (`@/components/ui/scale-picker`); `Button`, `Card`, `CardTitle`.
- Produces: `export function SessionPlayer(props: { session: GeneratedSession; onFinish(r: { completed: CompletedExercise[]; postSessionPain: number }): void; onExit(): void })`.

- [ ] **Step 1: Implement the component**

Create `src/components/workout/session-player.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, SkipForward, Check, X } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScalePicker } from "@/components/ui/scale-picker";
import { useCountdown } from "@/lib/use-countdown";
import {
  buildSteps,
  toCompletedExercises,
  type PhaseStatus,
} from "@/lib/session-player";
import type { GeneratedSession } from "@/lib/decision-engine";
import type { CompletedExercise } from "@/lib/log-schemas";

const SIDE_LABEL: Record<string, string> = {
  left: "Sisi kiri",
  right: "Sisi kanan",
  bilateral: "Kiri + kanan",
};

export function SessionPlayer({
  session,
  onFinish,
  onExit,
}: {
  session: GeneratedSession;
  onFinish: (r: { completed: CompletedExercise[]; postSessionPain: number }) => void;
  onExit: () => void;
}) {
  const steps = useMemo(() => buildSteps(session), [session]);
  const [index, setIndex] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, PhaseStatus>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [pain, setPain] = useState(2);

  const step = steps[index];
  const timer = useCountdown(step?.seconds ?? 0, { autoStart: true });

  // Rest auto-advances when its countdown hits 0; exercise phases never
  // auto-advance (hybrid timing — they wait for a tap).
  useEffect(() => {
    if (step?.kind === "rest" && timer.done) goNext();
    // goNext is stable enough for this guard; deps intentionally minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, timer.done]);

  const totalExerciseSteps = steps.filter((s) => s.kind === "exercise").length;
  const doneExerciseSteps = steps
    .slice(0, index)
    .filter((s) => s.kind === "exercise").length;

  function goNext() {
    if (index + 1 >= steps.length) {
      setShowSummary(true);
    } else {
      setIndex((i) => i + 1);
      timer.reset(steps[index + 1].seconds);
    }
  }

  function markAndNext(status: PhaseStatus) {
    if (step.kind === "exercise") {
      setStatuses((s) => ({ ...s, [step.phaseId]: status }));
    }
    goNext();
  }

  if (showSummary) {
    return (
      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card>
          <CardTitle>Sesi selesai</CardTitle>
          <p className="mb-3 text-sm text-muted-foreground">
            Gimana nyeri kamu setelah sesi ini?
          </p>
          <ScalePicker
            value={pain}
            onChange={setPain}
            min={0}
            max={10}
            lowLabel="Tidak nyeri"
            highLabel="Sangat nyeri"
          />
        </Card>
        <Button
          size="lg"
          onClick={() =>
            onFinish({
              completed: toCompletedExercises(session, statuses),
              postSessionPain: pain,
            })
          }
        >
          <Check size={18} /> Simpan sesi
        </Button>
        <p className="px-1 text-xs text-muted-foreground">
          SpineCoach AI bukan pengganti dokter atau fisioterapis. Hentikan
          gerakan yang menimbulkan nyeri tajam.
        </p>
      </div>
    );
  }

  if (!step) return null;

  return (
    <div className="flex flex-col gap-4 px-5 pb-8">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {Math.min(doneExerciseSteps + 1, totalExerciseSteps)} / {totalExerciseSteps}
        </span>
        <button
          type="button"
          onClick={onExit}
          className="text-xs font-semibold text-muted-foreground"
        >
          Keluar
        </button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(doneExerciseSteps / totalExerciseSteps) * 100}%` }}
        />
      </div>

      {step.kind === "rest" ? (
        <Card className="items-center text-center">
          <CardTitle>Istirahat</CardTitle>
          <p className="font-display text-5xl tabular text-primary">
            {timer.remaining}
          </p>
          <Button variant="outline" className="mt-4" onClick={goNext}>
            <SkipForward size={16} /> Lewati
          </Button>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>{step.exercise.name}</CardTitle>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {SIDE_LABEL[step.side ?? step.exercise.sideEmphasis]}
              </span>
            </div>
            <p
              className={
                "font-display text-6xl tabular " +
                (timer.done ? "text-success" : "text-foreground")
              }
            >
              {timer.remaining}
            </p>
            {step.exercise.cues.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {step.exercise.cues.join(" · ")}
              </p>
            )}
          </Card>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => (timer.running ? timer.pause() : timer.start())}
            >
              {timer.running ? <Pause size={16} /> : <Play size={16} />}
              {timer.running ? "Jeda" : "Lanjutkan"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => markAndNext("skipped")}
            >
              <X size={16} /> Lewati
            </Button>
          </div>
          <Button size="lg" onClick={() => markAndNext("done")}>
            <Check size={18} /> Lanjut
          </Button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `Card` does not accept the `className` used, match how existing pages pass `className` to `Card` — see `src/app/workout/page.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/workout/session-player.tsx
git commit -m "feat: interactive guided session player component"
```

---

### Task 4: Wire the player into the workout page + verify in app

**Files:**
- Modify: `src/app/workout/page.tsx`

**Interfaces:**
- Consumes: `SessionPlayer` (`@/components/workout/session-player`).

- [ ] **Step 1: Add view state and render the player**

In `src/app/workout/page.tsx`:

1. Add import: `import { SessionPlayer } from "@/components/workout/session-player";`
2. Add state near the top of the component: `const [playing, setPlaying] = useState(false);`
3. Replace `finishSession` with a version that accepts real results:

```tsx
  async function finishSession(result: {
    completed: Awaited<ReturnType<typeof getAllExercises>> extends never
      ? never
      : { exerciseId: string; name: string; domain: Exercise["domain"]; completed: boolean }[];
    postSessionPain: number;
  }) {
    if (!user || !session) return;
    setSaving(true);
    await putWorkoutLog({
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: Date.now(),
      movementFocus: session.movementFocus,
      intensity: session.intensity,
      estimatedMinutes: session.estimatedMinutes,
      exercises: result.completed,
      postSessionPain: result.postSessionPain,
    });
    await refreshLogs();
    router.push("/progress");
  }
```

Note: the exact `completed` element type is `CompletedExercise` from `@/lib/log-schemas` — import it and type the param as `{ completed: CompletedExercise[]; postSessionPain: number }` instead of the verbose inline type:

```tsx
import type { CompletedExercise } from "@/lib/log-schemas";
// ...
  async function finishSession(result: {
    completed: CompletedExercise[];
    postSessionPain: number;
  }) { /* body as above, exercises: result.completed */ }
```

4. In the render, when `session` is a valid non-escalated session and `playing` is true, return the player instead of the overview:

```tsx
  if (playing) {
    return (
      <div>
        <TopBar title="Sesi berjalan" subtitle={session.movementFocus} />
        <SessionPlayer
          session={session}
          onFinish={finishSession}
          onExit={() => setPlaying(false)}
        />
      </div>
    );
  }
```

Place this block right after the `if (!session) return null;` guard so `session` is non-null.

5. Replace the existing bottom `<Button ... onClick={finishSession}>Selesaikan sesi</Button>` in the overview with a start button:

```tsx
        <Button size="lg" onClick={() => setPlaying(true)} disabled={!user}>
          Mulai sesi
        </Button>
```

- [ ] **Step 2: Typecheck and run the full suite**

Run: `npx tsc --noEmit`
Expected: clean.
Run: `npx vitest run`
Expected: all pass (session-player + use-countdown + engine suites).

- [ ] **Step 3: Commit**

```bash
git add src/app/workout/page.tsx
git commit -m "feat: launch guided player from workout page, log real completion + pain"
```

- [ ] **Step 4: Verify end-to-end in the running app**

The dev server is already running (preview). In the app as user Archie:
1. Do a real check-in (any readiness), open Workout → tap **Mulai sesi**.
2. Confirm: a countdown runs on the first exercise; **Jeda** pauses it; **Lanjut** advances and a 20s **Istirahat** screen appears before the next exercise; a bilateral exercise shows two phases labelled Sisi kiri then Sisi kanan.
3. Skip one exercise with **Lewati**, complete others with **Lanjut**, reach the summary, pick a post-session pain, tap **Simpan sesi**.
4. Verify no console errors and that it navigates to Progress.
5. Inspect the written `WorkoutLog` in IndexedDB: the skipped exercise has `completed: false`, others `true`, and `postSessionPain` matches the picked value.

- [ ] **Step 5: Screenshot proof**

Capture the player mid-session and the summary screen.

---

## Self-Review Notes

- **Spec coverage:** step model + bilateral split + rest rules + completion (T1); hybrid timer via non-auto-advancing hook (T2); player UI with pause/skip/next, rest screen, progress, post-pain summary (T3); page wiring + real log write + e2e (T4). All spec sections covered.
- **Constraints:** hybrid (exercise timer never auto-advances — hook only flips `done`, component advances on tap); rest 20s skippable and auto-advances (the `useEffect` in T3 calls `goNext` when a rest timer's `done` flips, and **Lewati** advances manually); pain captured before write; disclaimer present. Exercise steps deliberately have no such effect.
- **Type consistency:** `PhaseStatus`, `Step`, `buildSteps`, `toCompletedExercises` defined in T1 and consumed in T3; `CompletedExercise` from `@/lib/log-schemas` used in T3/T4; `useCountdown` signature defined in T2 and consumed in T3.
- **Placeholder scan:** none.
