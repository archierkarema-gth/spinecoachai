import { describe, it, expect } from "vitest";
import type { Exercise } from "@/lib/exercise-schemas";
import type { AsymmetryLog, SessionLog } from "@/lib/log-schemas";
import type { User } from "@/lib/schemas";
import {
  activeExerciseForFamily,
  familyCurrentLevel,
  evaluatePromotion,
  evaluateDemotion,
  asymmetryAlert,
  projectFamily,
} from "@/lib/progression";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function ex(partial: Partial<Exercise> & { id: string }): Exercise {
  return {
    name: partial.id,
    domain: "core",
    difficulty: "beginner",
    durationSeconds: 30,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: [],
    contraindications: [],
    progressionId: null,
    regressionId: null,
    muscles: [],
    videoUrl: null,
    category: "core",
    level: 1,
    family: "fam",
    isFoundational: true,
    ...partial,
  };
}

function log(partial: Partial<SessionLog> & { exerciseId: string; createdAt: number }): SessionLog {
  return {
    id: `${partial.exerciseId}-${partial.createdAt}`,
    userId: "u1",
    date: "2023-11-14",
    repsDone: null,
    holdSecondsDone: null,
    formRating: 5,
    mirrorCheckPass: null,
    rpe: 6,
    ...partial,
  };
}

const user: User = {
  id: "u1",
  name: "T",
  age: 30,
  createdAt: 0,
  trainingPreset: "balanced",
  ownedEquipment: [],
};

describe("family position", () => {
  const lib: Exercise[] = [
    ex({ id: "a", family: "push", level: 1, progressionNextId: "b" }),
    ex({ id: "b", family: "push", level: 2, progressionNextId: "c" }),
    ex({ id: "c", family: "push", level: 3 }),
  ];

  it("returns entry move when nothing logged", () => {
    expect(activeExerciseForFamily("push", lib, [])?.id).toBe("a");
    expect(familyCurrentLevel("push", lib, [])).toBe(1);
  });

  it("returns highest logged member", () => {
    const logs = [log({ exerciseId: "a", createdAt: NOW - DAY }), log({ exerciseId: "b", createdAt: NOW })];
    expect(activeExerciseForFamily("push", lib, logs)?.id).toBe("b");
    expect(familyCurrentLevel("push", lib, logs)).toBe(2);
  });
});

describe("evaluatePromotion (§6.3)", () => {
  const cur = ex({
    id: "cur",
    repTargetMin: 5,
    repTargetMax: 10,
    progressionNextId: "next",
  });
  const next = ex({ id: "next", level: 2 });
  const lib = [cur, next];

  function cleanLogs(): SessionLog[] {
    // 3 qualifying sessions: reps >= max, form >=4, rpe <=8.
    return [0, 1, 2].map((i) =>
      log({ exerciseId: "cur", createdAt: NOW - i * DAY, repsDone: 10, formRating: 5, rpe: 6 })
    );
  }

  it("promotes when all rules pass", () => {
    const r = evaluatePromotion(cur, cleanLogs(), [], user, lib, NOW);
    expect(r.promote).toBe(true);
    expect(r.ready).toBe(true);
    expect(r.nextId).toBe("next");
  });

  it("does not promote with too few qualifying sessions", () => {
    const logs = [log({ exerciseId: "cur", createdAt: NOW, repsDone: 10 })];
    expect(evaluatePromotion(cur, logs, [], user, lib, NOW).promote).toBe(false);
  });

  it("blocks on grinding rpe > 8", () => {
    const logs = [0, 1, 2].map((i) =>
      log({ exerciseId: "cur", createdAt: NOW - i * DAY, repsDone: 10, rpe: 9 })
    );
    expect(evaluatePromotion(cur, logs, [], user, lib, NOW).promote).toBe(false);
  });

  it("blocks on recent lateral asymmetry (§6.3.5)", () => {
    const asym: AsymmetryLog[] = [
      { id: "x", userId: "u1", createdAt: NOW - DAY, date: "d", side: "right", type: "sharp-pain", reviewed: false },
    ];
    const r = evaluatePromotion(cur, cleanLogs(), asym, user, lib, NOW);
    expect(r.promote).toBe(false);
  });

  it("ready but PT-locked when next requires clearance and user not cleared", () => {
    const gated = [cur, ex({ id: "next", requiresPTClearance: true })];
    const r = evaluatePromotion(cur, cleanLogs(), [], user, gated, NOW);
    expect(r.ready).toBe(true);
    expect(r.promote).toBe(false);
    expect(r.blockedBy).toBe("pt-clearance");
  });

  it("ready but contraindicated-locked", () => {
    const gated = [cur, ex({ id: "next", contraindicated: true })];
    const r = evaluatePromotion(cur, cleanLogs(), [], user, gated, NOW);
    expect(r.blockedBy).toBe("contraindicated");
    expect(r.promote).toBe(false);
  });

  it("respects mirrorCheckRequired", () => {
    const mirrorEx = ex({ id: "cur", repTargetMax: 10, progressionNextId: "next", mirrorCheckRequired: true });
    const logsNoMirror = [0, 1, 2].map((i) =>
      log({ exerciseId: "cur", createdAt: NOW - i * DAY, repsDone: 10, mirrorCheckPass: null })
    );
    expect(evaluatePromotion(mirrorEx, logsNoMirror, [], user, [mirrorEx, next], NOW).promote).toBe(false);
    const logsMirror = [0, 1, 2].map((i) =>
      log({ exerciseId: "cur", createdAt: NOW - i * DAY, repsDone: 10, mirrorCheckPass: true })
    );
    expect(evaluatePromotion(mirrorEx, logsMirror, [], user, [mirrorEx, next], NOW).promote).toBe(true);
  });

  it("promotes on hold target for isometrics", () => {
    const iso = ex({ id: "iso", holdSeconds: 30, progressionNextId: "next" });
    const logs = [0, 1, 2].map((i) =>
      log({ exerciseId: "iso", createdAt: NOW - i * DAY, holdSecondsDone: 35 })
    );
    expect(evaluatePromotion(iso, logs, [], user, [iso, next], NOW).promote).toBe(true);
  });
});

describe("evaluateDemotion (§6.4)", () => {
  const cur = ex({ id: "cur", repTargetMin: 5, progressionPrevId: "prev" });

  it("suggests demote when below min 3 sessions", () => {
    const logs = [0, 1, 2].map((i) =>
      log({ exerciseId: "cur", createdAt: NOW - i * DAY, repsDone: 3 })
    );
    const r = evaluateDemotion(cur, logs, [], NOW);
    expect(r.suggestDemote).toBe(true);
    expect(r.prevId).toBe("prev");
  });

  it("does not force when reps are fine", () => {
    const logs = [0, 1, 2].map((i) =>
      log({ exerciseId: "cur", createdAt: NOW - i * DAY, repsDone: 8 })
    );
    expect(evaluateDemotion(cur, logs, [], NOW).suggestDemote).toBe(false);
  });
});

describe("asymmetryAlert (§6.6) — neutral language", () => {
  it("raises on repeated same-side pain and never says 'worsening'", () => {
    const asym: AsymmetryLog[] = [0, 1, 2].map((i) => ({
      id: `a${i}`,
      userId: "u1",
      createdAt: NOW - i * DAY,
      date: "d",
      side: "right" as const,
      type: "sharp-pain" as const,
      reviewed: false,
    }));
    const alert = asymmetryAlert(asym, NOW);
    expect(alert.raised).toBe(true);
    expect(alert.message).not.toMatch(/memburuk/i);
    expect(alert.message).toMatch(/PT/);
  });
});

describe("projectFamily (§6B)", () => {
  it("achieved once at target level", () => {
    expect(projectFamily(NOW - 5 * 7 * DAY, 3, NOW).status).toBe("achieved");
  });

  it("on-track when pace meets requirement", () => {
    // 1 level gained in 5 weeks → 0.2/wk >= required 0.077.
    expect(projectFamily(NOW - 5 * 7 * DAY, 2, NOW).status).toBe("on-track");
  });

  it("behind when no progress after many weeks", () => {
    expect(projectFamily(NOW - 20 * 7 * DAY, 1, NOW).status).toBe("behind");
  });

  it("never verdicts behind on day 0", () => {
    expect(projectFamily(NOW, 1, NOW).status).toBe("on-track");
  });
});
