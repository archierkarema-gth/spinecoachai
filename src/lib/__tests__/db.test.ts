import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  getAllExercises,
  getAssessmentsForUser,
  getDB,
  getFirstUser,
  getLatestAssessmentForUser,
  getUser,
  putAssessment,
  putUser,
  getBenchmarkLogsForUser,
  putBenchmarkLog,
  syncSeedExercises,
} from "@/lib/db";
import { EXERCISE_SEED } from "@/lib/exercise-seed";

// Tests share one fake-indexeddb instance (module-level db handle in
// lib/db.ts) — each test uses its own ids rather than resetting the db.
describe("db layer", () => {
  it("stores and retrieves a user", async () => {
    const user = {
      id: "u1",
      name: "Archie",
      age: 32,
      createdAt: Date.now(),
      trainingPreset: "balanced" as const,
      ownedEquipment: [],
    };
    await putUser(user);
    await expect(getUser("u1")).resolves.toEqual(user);
    await expect(getFirstUser()).resolves.toEqual(user);
  });

  it("stores assessments and finds the latest one for a user", async () => {
    const base = {
      userId: "u1",
      diagnosedByPhysician: false,
      painLevel: 2,
      activityLevel: "light" as const,
      availableMinutesPerDay: 20,
      primaryGoals: "Postur lebih tegak",
      redFlags: {
        neurologicalSymptoms: false,
        bowelBladderChanges: false,
        severeWorseningPain: false,
        trauma: false,
        feverWithSevereBackPain: false,
      },
    };
    const older = { ...base, id: "a1", createdAt: 1000 };
    const newer = { ...base, id: "a2", createdAt: 2000 };

    await putAssessment(older);
    await putAssessment(newer);

    const all = await getAssessmentsForUser("u1");
    expect(all).toHaveLength(2);

    const latest = await getLatestAssessmentForUser("u1");
    expect(latest?.id).toBe("a2");
  });
});

describe("syncSeedExercises", () => {
  it("tops up an install whose store predates new seed entries", async () => {
    // Simulate an old install: only the first seed exercise is present
    // (the old seedExercisesIfEmpty would then write nothing at all).
    const db = await getDB();
    await db.put("exercises", EXERCISE_SEED[0]);
    expect((await getAllExercises()).length).toBe(1);

    await syncSeedExercises();

    const all = await getAllExercises();
    expect(all.length).toBe(EXERCISE_SEED.length);
    const ids = new Set(all.map((e) => e.id));
    // The additions this migration exists for actually arrive.
    expect(ids.has("ex-kegel-dasar")).toBe(true);
    expect(ids.has("ex-l-sit")).toBe(true);
  });

  it("is idempotent — a second run changes nothing", async () => {
    await syncSeedExercises();
    await syncSeedExercises();
    expect((await getAllExercises()).length).toBe(EXERCISE_SEED.length);
  });
});

describe("benchmark logs", () => {
  it("stores benchmark logs and returns them newest first for a user", async () => {
    const older = {
      id: "bl1",
      userId: "u-bench",
      createdAt: 1000,
      type: "plank_hold" as const,
      value: 30,
    };
    const newer = {
      id: "bl2",
      userId: "u-bench",
      createdAt: 2000,
      type: "plank_hold" as const,
      value: 40,
    };

    await putBenchmarkLog(older);
    await putBenchmarkLog(newer);

    const all = await getBenchmarkLogsForUser("u-bench");
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe("bl2");
    expect(all[1].id).toBe("bl1");
  });
});
