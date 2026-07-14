import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  getAssessmentsForUser,
  getFirstUser,
  getLatestAssessmentForUser,
  getUser,
  putAssessment,
  putUser,
  getBenchmarkLogsForUser,
  putBenchmarkLog,
} from "@/lib/db";

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
