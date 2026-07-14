import { describe, expect, it } from "vitest";
import {
  computeStreak,
  sessionsInLastDays,
  painTrend,
} from "@/lib/progress";
import type { WorkoutLog, PainLog } from "@/lib/log-schemas";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-07-10T12:00:00").getTime();

function log(createdAt: number, postSessionPain?: number): WorkoutLog {
  return {
    id: `w-${createdAt}`,
    userId: "u1",
    createdAt,
    movementFocus: "Stabilitas",
    intensity: "moderate",
    estimatedMinutes: 20,
    exercises: [],
    postSessionPain,
  };
}

function pain(createdAt: number, painLevel: number): PainLog {
  return { id: `p-${createdAt}`, userId: "u1", createdAt, painLevel };
}

describe("computeStreak", () => {
  it("returns 0 with no logs", () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it("counts consecutive days including today", () => {
    const logs = [log(NOW), log(NOW - DAY), log(NOW - 2 * DAY)];
    expect(computeStreak(logs, NOW)).toBe(3);
  });

  it("counts multiple sessions in one day once", () => {
    const logs = [log(NOW), log(NOW - 1000), log(NOW - DAY)];
    expect(computeStreak(logs, NOW)).toBe(2);
  });

  it("is broken when the last session is older than yesterday", () => {
    expect(computeStreak([log(NOW - 3 * DAY)], NOW)).toBe(0);
  });

  it("still counts a streak ending yesterday", () => {
    expect(computeStreak([log(NOW - DAY), log(NOW - 2 * DAY)], NOW)).toBe(2);
  });
});

describe("sessionsInLastDays", () => {
  it("counts only sessions within the window", () => {
    const logs = [log(NOW), log(NOW - 3 * DAY), log(NOW - 10 * DAY)];
    expect(sessionsInLastDays(logs, 7, NOW)).toBe(2);
  });
});

describe("painTrend", () => {
  it("merges pain logs and post-session pain, sorted oldest first", () => {
    const trend = painTrend(
      [pain(NOW - DAY, 5)],
      [log(NOW, 3), log(NOW - 2 * DAY, 6)]
    );
    expect(trend.map((t) => t.painLevel)).toEqual([6, 5, 3]);
  });
});

import {
  latestBenchmark,
  personalBest,
  benchmarkTrend,
} from "@/lib/progress";
import type { BenchmarkLog } from "@/lib/log-schemas";

function bench(
  createdAt: number,
  value: number,
  type: BenchmarkLog["type"] = "plank_hold"
): BenchmarkLog {
  return { id: `b-${createdAt}`, userId: "u1", createdAt, type, value };
}

describe("latestBenchmark", () => {
  it("returns null with no logs", () => {
    expect(latestBenchmark([], "plank_hold")).toBeNull();
  });

  it("returns the most recent value for the given type", () => {
    const logs = [bench(1000, 30), bench(3000, 50), bench(2000, 40)];
    expect(latestBenchmark(logs, "plank_hold")).toBe(50);
  });
});

describe("personalBest", () => {
  it("returns null with no logs", () => {
    expect(personalBest([], "plank_hold")).toBeNull();
  });

  it("returns the max value for the given type", () => {
    const logs = [bench(1000, 30), bench(2000, 55), bench(3000, 40)];
    expect(personalBest(logs, "plank_hold")).toBe(55);
  });
});

describe("benchmarkTrend", () => {
  it("returns an empty array with no logs", () => {
    expect(benchmarkTrend([], "plank_hold")).toEqual([]);
  });

  it("returns points oldest to newest for the given type", () => {
    const logs = [bench(3000, 50), bench(1000, 30), bench(2000, 40)];
    expect(benchmarkTrend(logs, "plank_hold")).toEqual([
      { createdAt: 1000, value: 30 },
      { createdAt: 2000, value: 40 },
      { createdAt: 3000, value: 50 },
    ]);
  });
});
