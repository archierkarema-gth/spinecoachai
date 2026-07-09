import { describe, expect, it } from "vitest";
import { buildReport, formatReportText } from "@/lib/report";
import type { User, Assessment } from "@/lib/schemas";
import type { WorkoutLog, PainLog } from "@/lib/log-schemas";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-07-10T12:00:00").getTime();

const user: User = { id: "u1", name: "Archie", age: 32, createdAt: 0 };

const assessment: Assessment = {
  id: "a1",
  userId: "u1",
  createdAt: 0,
  diagnosedByPhysician: true,
  painLevel: 3,
  activityLevel: "light",
  availableMinutesPerDay: 30,
  primaryGoals: "Kurangi nyeri",
  redFlags: {
    neurologicalSymptoms: false,
    bowelBladderChanges: false,
    severeWorseningPain: false,
    trauma: false,
    feverWithSevereBackPain: false,
  },
};

function wlog(createdAt: number): WorkoutLog {
  return {
    id: `w-${createdAt}`,
    userId: "u1",
    createdAt,
    movementFocus: "Stabilitas",
    intensity: "moderate",
    estimatedMinutes: 20,
    exercises: [],
  };
}

function plog(createdAt: number, painLevel: number): PainLog {
  return { id: `p-${createdAt}`, userId: "u1", createdAt, painLevel };
}

describe("buildReport", () => {
  it("averages pain within the period and reports the latest", () => {
    // painLogs are newest-first as returned by the db layer.
    const pains = [plog(NOW, 2), plog(NOW - DAY, 4), plog(NOW - 40 * DAY, 9)];
    const report = buildReport(user, assessment, [wlog(NOW)], pains, 30, NOW);

    expect(report.avgPainInPeriod).toBe(3); // (2 + 4) / 2, older one excluded
    expect(report.latestPain).toBe(2);
    expect(report.sessionsInPeriod).toBe(1);
    expect(report.primaryGoals).toBe("Kurangi nyeri");
  });

  it("handles no pain logs", () => {
    const report = buildReport(user, assessment, [], [], 30, NOW);
    expect(report.avgPainInPeriod).toBeNull();
    expect(report.latestPain).toBeNull();
  });

  it("formats a text report containing the disclaimer", () => {
    const report = buildReport(user, assessment, [], [], 30, NOW);
    const text = formatReportText(report);
    expect(text).toContain("SpineCoach AI");
    expect(text).toContain("tidak mendiagnosis");
  });
});
