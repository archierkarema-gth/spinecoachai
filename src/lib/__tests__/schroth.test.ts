import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  getSchrothLogForDate,
  getSchrothLogsForUser,
  putSchrothLog,
  resetUserData,
} from "@/lib/db";
import {
  schrothExerciseSchema,
  schrothLogSchema,
  todayKey,
} from "@/lib/schroth-schemas";
import { SCHROTH_SEED } from "@/lib/schroth-seed";

describe("schroth-schemas", () => {
  it("todayKey formats as YYYY-MM-DD from a fixed timestamp", () => {
    // 2026-07-20T03:00:00Z — assert only the shape, not a specific date,
    // since the function is timezone-dependent (local date key) by design.
    const key = todayKey(Date.UTC(2026, 6, 20, 3, 0, 0));
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejects a malformed dateKey", () => {
    const result = schrothLogSchema.safeParse({
      id: "x",
      userId: "u1",
      dateKey: "20-07-2026",
      completedIds: [],
      updatedAt: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it("every seed exercise validates against the schema", () => {
    for (const ex of SCHROTH_SEED) {
      expect(schrothExerciseSchema.safeParse(ex).success).toBe(true);
    }
  });

  it("has exactly 6 exercises with unique ids, matching the spec's daily checklist", () => {
    expect(SCHROTH_SEED).toHaveLength(6);
    const ids = new Set(SCHROTH_SEED.map((e) => e.id));
    expect(ids.size).toBe(SCHROTH_SEED.length);
  });
});

describe("schrothLogs db layer", () => {
  it("stores today's checklist and retrieves it by dateKey", async () => {
    await resetUserData();
    const userId = "u-schroth";
    const dateKey = "2026-07-20";
    await putSchrothLog({
      id: `${userId}_${dateKey}`,
      userId,
      dateKey,
      completedIds: ["schroth-elongasi-aktif"],
      updatedAt: 1000,
    });

    const found = await getSchrothLogForDate(userId, dateKey);
    expect(found?.completedIds).toEqual(["schroth-elongasi-aktif"]);

    const missing = await getSchrothLogForDate(userId, "2026-07-19");
    expect(missing).toBeUndefined();
  });

  it("upserting the same day (by id) does not create a duplicate log", async () => {
    await resetUserData();
    const userId = "u-schroth-2";
    const dateKey = "2026-07-20";
    const id = `${userId}_${dateKey}`;

    await putSchrothLog({
      id,
      userId,
      dateKey,
      completedIds: ["schroth-elongasi-aktif"],
      updatedAt: 1000,
    });
    await putSchrothLog({
      id,
      userId,
      dateKey,
      completedIds: ["schroth-elongasi-aktif", "schroth-rab"],
      updatedAt: 2000,
    });

    const all = await getSchrothLogsForUser(userId);
    expect(all).toHaveLength(1);
    expect(all[0].completedIds).toHaveLength(2);
  });
});
