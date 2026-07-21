import { describe, expect, it } from "vitest";
import { shouldShowReminder } from "@/lib/pwa";

function at(hour: number, minute = 0): Date {
  return new Date(2026, 6, 21, hour, minute, 0, 0); // 2026-07-21 local time
}

describe("shouldShowReminder", () => {
  it("is false before the hour threshold even with no check-in", () => {
    expect(
      shouldShowReminder({
        now: at(15, 59),
        hasAssessment: true,
        latestCheckInAt: null,
      })
    ).toBe(false);
  });

  it("is true at/after the hour threshold with no check-in yet", () => {
    expect(
      shouldShowReminder({
        now: at(16, 0),
        hasAssessment: true,
        latestCheckInAt: null,
      })
    ).toBe(true);
  });

  it("is false if the latest check-in was already today", () => {
    const now = at(18, 0);
    const checkedInToday = new Date(2026, 6, 21, 9, 0, 0, 0).getTime();
    expect(
      shouldShowReminder({
        now,
        hasAssessment: true,
        latestCheckInAt: checkedInToday,
      })
    ).toBe(false);
  });

  it("is true if the latest check-in was yesterday", () => {
    const now = at(18, 0);
    const checkedInYesterday = new Date(2026, 6, 20, 9, 0, 0, 0).getTime();
    expect(
      shouldShowReminder({
        now,
        hasAssessment: true,
        latestCheckInAt: checkedInYesterday,
      })
    ).toBe(true);
  });

  it("is false when there is no assessment yet, regardless of time", () => {
    expect(
      shouldShowReminder({
        now: at(20, 0),
        hasAssessment: false,
        latestCheckInAt: null,
      })
    ).toBe(false);
  });

  it("respects a custom hourThreshold", () => {
    expect(
      shouldShowReminder({
        now: at(17, 30),
        hasAssessment: true,
        latestCheckInAt: null,
        hourThreshold: 18,
      })
    ).toBe(false);
    expect(
      shouldShowReminder({
        now: at(18, 30),
        hasAssessment: true,
        latestCheckInAt: null,
        hourThreshold: 18,
      })
    ).toBe(true);
  });
});
