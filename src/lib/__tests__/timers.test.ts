import { describe, it, expect } from "vitest";
import {
  DEFAULT_PATTERN,
  cycleLength,
  phaseAt,
  completedCycles,
} from "@/lib/breathing-timer";
import { kegelSchedule, scheduleSeconds } from "@/lib/kegel-timer";
import { minutesUntil, nextDaily, DAILY_REMINDERS } from "@/lib/reminders";

describe("breathing-timer", () => {
  it("cycle length sums the phases", () => {
    expect(cycleLength(DEFAULT_PATTERN)).toBe(12); // 4+2+6+0
  });

  it("resolves phases across a cycle, skipping 0-duration rest", () => {
    expect(phaseAt(DEFAULT_PATTERN, 0).phase).toBe("inhale");
    expect(phaseAt(DEFAULT_PATTERN, 3)).toMatchObject({ phase: "inhale", secondsLeft: 1 });
    expect(phaseAt(DEFAULT_PATTERN, 4).phase).toBe("hold");
    expect(phaseAt(DEFAULT_PATTERN, 6).phase).toBe("exhale");
    expect(phaseAt(DEFAULT_PATTERN, 11)).toMatchObject({ phase: "exhale", secondsLeft: 1 });
  });

  it("advances the cycle index", () => {
    expect(phaseAt(DEFAULT_PATTERN, 12).cycle).toBe(1);
    expect(completedCycles(DEFAULT_PATTERN, 25)).toBe(2);
  });

  it("includes a non-zero rest phase when set", () => {
    const p = { inhale: 4, hold: 0, exhale: 4, rest: 2 };
    expect(phaseAt(p, 8).phase).toBe("rest");
    expect(cycleLength(p)).toBe(10);
  });
});

describe("kegel-timer", () => {
  it("quick mode: contract/relax pairs", () => {
    const s = kegelSchedule("quick", 3);
    expect(s).toHaveLength(6);
    expect(s[0].kind).toBe("contract");
    expect(s[1].kind).toBe("relax");
  });

  it("elevator mode: laddered holds + release per rep", () => {
    const s = kegelSchedule("elevator", 2);
    // 4 holds + 1 release per rep × 2 = 10 steps.
    expect(s).toHaveLength(10);
    expect(s.filter((x) => x.kind === "hold")).toHaveLength(8);
    expect(s.filter((x) => x.kind === "relax")).toHaveLength(2);
  });

  it("schedule seconds add up", () => {
    expect(scheduleSeconds(kegelSchedule("quick", 1))).toBe(6); // 3 + 3
  });
});

describe("reminders", () => {
  it("minutesUntil is negative once passed", () => {
    const now = new Date(2026, 6, 22, 8, 0); // 08:00
    expect(minutesUntil(now, "07:00")).toBe(-60);
    expect(minutesUntil(now, "12:00")).toBe(240);
  });

  it("nextDaily picks the upcoming reminder", () => {
    const now = new Date(2026, 6, 22, 8, 0);
    const n = nextDaily(now);
    expect(n?.reminder.id).toBe("noon");
    expect(n?.wrapped).toBe(false);
  });

  it("nextDaily wraps to tomorrow after the last reminder", () => {
    const now = new Date(2026, 6, 22, 22, 0); // after 21:00
    const n = nextDaily(now, DAILY_REMINDERS);
    expect(n?.reminder.id).toBe("morning");
    expect(n?.wrapped).toBe(true);
  });
});
