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
