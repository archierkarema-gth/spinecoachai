import { describe, expect, it } from "vitest";
import {
  decideIntensity,
  generateSession,
  deriveGoalWeights,
  deriveCapability,
  pickForDomain,
  countCleanStreak,
  progressedDuration,
  recentLoad,
  applyLoadSuppression,
  type EngineInputs,
} from "@/lib/decision-engine";
import { EXERCISE_SEED } from "@/lib/exercise-seed";
import type { Assessment } from "@/lib/schemas";
import type { CheckIn } from "@/lib/exercise-schemas";
import type { ReassessmentLog, WorkoutLog } from "@/lib/log-schemas";
import { exerciseSchema } from "@/lib/exercise-schemas";

const noRedFlags = {
  neurologicalSymptoms: false,
  bowelBladderChanges: false,
  severeWorseningPain: false,
  trauma: false,
  feverWithSevereBackPain: false,
};

const baseAssessment: Assessment = {
  id: "a1",
  userId: "u1",
  createdAt: 0,
  diagnosedByPhysician: true,
  painLevel: 3,
  activityLevel: "light",
  availableMinutesPerDay: 30,
  primaryGoals: "Kurangi nyeri",
  redFlags: noRedFlags,
};

function checkIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    id: "c1",
    userId: "u1",
    createdAt: 1_000_000,
    painLevel: 2,
    sleepQuality: 4,
    energyLevel: 4,
    recovery: 4,
    availableMinutes: 30,
    ...overrides,
  };
}

function inputs(overrides: Partial<EngineInputs> = {}): EngineInputs {
  return {
    assessment: baseAssessment,
    checkIn: checkIn(),
    exercises: EXERCISE_SEED,
    recentSessionTimestamps: [],
    ...overrides,
  };
}

describe("decideIntensity", () => {
  it("returns recovery when pain is high", () => {
    expect(decideIntensity(checkIn({ painLevel: 8 }))).toBe("recovery");
  });

  it("returns light when readiness is low", () => {
    expect(decideIntensity(checkIn({ recovery: 1 }))).toBe("light");
  });

  it("returns full when readiness is high and pain low", () => {
    expect(
      decideIntensity(
        checkIn({ painLevel: 1, recovery: 5, energyLevel: 5, sleepQuality: 5 })
      )
    ).toBe("full");
  });

  it("returns moderate in the middle", () => {
    expect(
      decideIntensity(checkIn({ painLevel: 3, recovery: 3, energyLevel: 3 }))
    ).toBe("moderate");
  });
});

describe("generateSession — safety", () => {
  it("escalates and prescribes nothing when a red flag is set", () => {
    const result = generateSession(
      inputs({
        assessment: {
          ...baseAssessment,
          redFlags: { ...noRedFlags, neurologicalSymptoms: true },
        },
      })
    );
    expect(result.escalated).toBe(true);
    expect(result.blocks).toHaveLength(0);
  });

  it("high pain yields a recovery session with no strength block", () => {
    const result = generateSession(inputs({ checkIn: checkIn({ painLevel: 9 }) }));
    expect(result.escalated).toBe(false);
    expect(result.intensity).toBe("recovery");
    expect(result.blocks.some((b) => b.domain === "strength")).toBe(false);
    expect(result.blocks.flatMap((b) => b.exercises).length).toBeGreaterThan(0);
  });
});

describe("generateSession — building", () => {
  it("only picks beginner moves on a light day", () => {
    const result = generateSession(inputs({ checkIn: checkIn({ recovery: 1 }) }));
    const all = result.blocks.flatMap((b) => b.exercises);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((ex) => ex.difficulty === "beginner")).toBe(true);
  });

  it("respects the available-time budget", () => {
    const result = generateSession(
      inputs({ checkIn: checkIn({ availableMinutes: 10 }) })
    );
    expect(result.estimatedMinutes).toBeLessThanOrEqual(11);
    expect(result.blocks.length).toBeGreaterThan(0);
  });

  it("produces reasoning for every non-escalated session", () => {
    const result = generateSession(inputs());
    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});

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
});

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
});

describe("generateSession — advanced surfacing", () => {
  it("leads the strength block with the hardest move for a capable, full-readiness user", () => {
    const result = generateSession(
      inputs({
        assessment: { ...baseAssessment, activityLevel: "active" },
        checkIn: checkIn({ painLevel: 1, recovery: 5, energyLevel: 5, sleepQuality: 5 }),
      })
    );
    const strength = result.blocks.find((b) => b.domain === "strength");
    expect(strength).toBeDefined();
    // Hardest-first: the first picked strength move must be advanced. Easiest-first
    // (the pre-fix behavior) would lead with a beginner move, failing this.
    expect(strength!.exercises[0].difficulty).toBe("advanced");
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

let wlogSeq = 0;
function wlog(
  exercises: { exerciseId: string; completed: boolean }[],
  postSessionPain = 0
): WorkoutLog {
  return {
    id: `w-${wlogSeq++}`,
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

describe("EXERCISE_SEED integrity", () => {
  it("has grown to 48 curated exercises", () => {
    expect(EXERCISE_SEED.length).toBe(48);
  });

  it("bodyweight moves have no equipment; geared moves list only known equipment", () => {
    const known = new Set(["pull-up bar", "dip bars"]);
    for (const ex of EXERCISE_SEED) {
      expect(ex.equipment.every((item) => known.has(item))).toBe(true);
    }
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

describe("generateSession — M9 progression swap", () => {
  // A leading incomplete/unrelated log breaks deriveCapability's 3-session
  // clean streak (which would otherwise bump the difficulty floor and push
  // ex-dead-bug, a beginner move, out of the pick window before the swap
  // gate is ever reached) while countCleanStreak safely skips it — the move
  // is absent from that log, so the dead-bug streak below still counts 6.
  const sixClean = [
    wlog([{ exerciseId: "ex-unrelated-warmup", completed: false }]),
    ...Array.from({ length: 6 }, () =>
      wlog([{ exerciseId: "ex-dead-bug", completed: true }])
    ),
  ];
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

describe("generateSession — M9 swap dedup", () => {
  // A minimal exercise pool of just ex-dead-bug (beginner, progressionId
  // ex-bird-dog) and ex-bird-dog (intermediate) themselves. Core's slot max
  // is 2 at full/balanced, so pickForDomain naturally surfaces BOTH moves for
  // this window — meaning ex-bird-dog is already among the domain's picks
  // before the swap pass ever runs. If dead-bug's streak then triggers a swap
  // to its own progression (bird-dog), the block would contain bird-dog
  // twice unless the engine detects the target is already picked and skips
  // the swap.
  const deadBugAndBirdDog = EXERCISE_SEED.filter((e) =>
    ["ex-dead-bug", "ex-bird-dog"].includes(e.id)
  );

  const sixCleanDeadBug = [
    wlog([{ exerciseId: "ex-unrelated-warmup", completed: false }]),
    ...Array.from({ length: 6 }, () =>
      wlog([{ exerciseId: "ex-dead-bug", completed: true }])
    ),
  ];

  const fullReady = checkIn({
    painLevel: 1,
    recovery: 5,
    energyLevel: 5,
    sleepQuality: 5,
  });

  it("never duplicates an exercise id within a block when the swap target is already picked", () => {
    const s = generateSession(
      inputs({
        checkIn: fullReady,
        exercises: deadBugAndBirdDog,
        workoutLogs: sixCleanDeadBug,
      })
    );
    for (const block of s.blocks) {
      const ids = block.exercises.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const allIds = s.blocks.flatMap((b) => b.exercises.map((e) => e.id));
    expect(allIds.filter((id) => id === "ex-bird-dog").length).toBeLessThanOrEqual(1);
  });
});

describe("recentLoad", () => {
  const H = 60 * 60 * 1000;
  function log(overrides: Partial<WorkoutLog>): WorkoutLog {
    return {
      id: "l1",
      userId: "u1",
      createdAt: 0,
      movementFocus: "x",
      intensity: "full",
      estimatedMinutes: 30,
      exercises: [],
      ...overrides,
    };
  }

  it("sums minutes weighted by intensity within 48h", () => {
    const now = 100 * H;
    // full 30m (weight 1.0 = 30) + light 30m (weight 0.5 = 15) = 45
    const logs = [
      log({ createdAt: now - 2 * H, intensity: "full", estimatedMinutes: 30 }),
      log({ createdAt: now - 10 * H, intensity: "light", estimatedMinutes: 30 }),
    ];
    expect(recentLoad(logs, now)).toBe(45);
  });

  it("excludes logs at or beyond 48h", () => {
    const now = 100 * H;
    const logs = [log({ createdAt: now - 49 * H, intensity: "full", estimatedMinutes: 30 })];
    expect(recentLoad(logs, now)).toBe(0);
  });

  it("includes a log at 47h", () => {
    const now = 100 * H;
    const logs = [log({ createdAt: now - 47 * H, intensity: "full", estimatedMinutes: 30 })];
    expect(recentLoad(logs, now)).toBe(30);
  });

  it("ignores future-dated logs", () => {
    const now = 100 * H;
    const logs = [log({ createdAt: now + 2 * H, intensity: "full", estimatedMinutes: 30 })];
    expect(recentLoad(logs, now)).toBe(0);
  });

  it("treats an unknown intensity string with the moderate fallback weight", () => {
    const now = 100 * H;
    const logs = [log({ createdAt: now - 1 * H, intensity: "weird", estimatedMinutes: 40 })];
    // fallback weight 0.75 → 40 * 0.75 = 30
    expect(recentLoad(logs, now)).toBe(30);
  });
});

describe("applyLoadSuppression", () => {
  const H = 60 * 60 * 1000;
  const now = 100 * H;
  function heavyLogs(): WorkoutLog[] {
    // two full 30m sessions in 48h → load 60 (>= 45)
    return [
      { id: "a", userId: "u1", createdAt: now - 2 * H, movementFocus: "x", intensity: "full", estimatedMinutes: 30, exercises: [] },
      { id: "b", userId: "u1", createdAt: now - 20 * H, movementFocus: "x", intensity: "full", estimatedMinutes: 30, exercises: [] },
    ];
  }

  it("drops full to moderate when load heavy and recovery <= 3", () => {
    expect(applyLoadSuppression("full", checkIn({ recovery: 3 }), heavyLogs(), now)).toBe("moderate");
  });

  it("drops moderate to light when load heavy and recovery <= 3", () => {
    expect(applyLoadSuppression("moderate", checkIn({ recovery: 2 }), heavyLogs(), now)).toBe("light");
  });

  it("does not drop when recovery >= 4 even if load heavy", () => {
    expect(applyLoadSuppression("full", checkIn({ recovery: 4 }), heavyLogs(), now)).toBe("full");
  });

  it("does not drop when load is light", () => {
    const lightLogs: WorkoutLog[] = [
      { id: "a", userId: "u1", createdAt: now - 2 * H, movementFocus: "x", intensity: "light", estimatedMinutes: 20, exercises: [] },
    ];
    expect(applyLoadSuppression("full", checkIn({ recovery: 2 }), lightLogs, now)).toBe("full");
  });

  it("never touches base light or recovery", () => {
    expect(applyLoadSuppression("light", checkIn({ recovery: 2 }), heavyLogs(), now)).toBe("light");
    expect(applyLoadSuppression("recovery", checkIn({ recovery: 2 }), heavyLogs(), now)).toBe("recovery");
  });
});

describe("generateSession — M10 recovery load", () => {
  const H = 60 * 60 * 1000;
  const nowTs = 1_000_000; // checkIn().createdAt default
  function fullLog(ageH: number): WorkoutLog {
    return {
      id: `fl-${ageH}`,
      userId: "u1",
      createdAt: nowTs - ageH * H,
      movementFocus: "x",
      intensity: "full",
      estimatedMinutes: 30,
      exercises: [],
    };
  }

  it("eases intensity one tier and notes it when 48h load is heavy and recovery marginal", () => {
    // base is "moderate" + heavy load + recovery≤3 → drop to "light"
    const s = generateSession(
      inputs({
        checkIn: checkIn({ painLevel: 1, recovery: 3, energyLevel: 3, sleepQuality: 4 }),
        workoutLogs: [fullLog(2), fullLog(20)], // load 60 >= 45
      })
    );
    expect(s.intensity).toBe("light");
    expect(s.reasoning.some((r) => r.includes("Beban 2 hari terakhir"))).toBe(true);
  });

  it("does not ease or note when load is light", () => {
    const s = generateSession(
      inputs({
        checkIn: checkIn({ painLevel: 1, recovery: 4, energyLevel: 4, sleepQuality: 4 }),
        workoutLogs: [fullLog(2)], // load 30 < 45
      })
    );
    expect(s.intensity).toBe("full");
    expect(s.reasoning.some((r) => r.includes("Beban 2 hari terakhir"))).toBe(false);
  });
});

describe("M11 dip equipment gating", () => {
  const R = { beginner: 0, intermediate: 1, advanced: 2 };

  it("excludes dip moves from strength when dip bars not owned", () => {
    const picks = pickForDomain(
      EXERCISE_SEED,
      "strength",
      R.beginner,
      R.advanced,
      20,
      { allowedEquipment: new Set<string>() }
    );
    expect(picks.some((e) => e.id.startsWith("ex-dip") || e.id === "ex-negative-dip" || e.id === "ex-full-dip")).toBe(false);
  });

  it("includes dip moves when dip bars owned", () => {
    const picks = pickForDomain(
      EXERCISE_SEED,
      "strength",
      R.beginner,
      R.advanced,
      20,
      { allowedEquipment: new Set(["dip bars"]) }
    );
    expect(picks.some((e) => e.equipment.includes("dip bars"))).toBe(true);
  });
});

