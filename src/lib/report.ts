import type { User, Assessment } from "@/lib/schemas";
import type { WorkoutLog, PainLog } from "@/lib/log-schemas";
import { computeStreak, sessionsInLastDays } from "@/lib/progress";

/**
 * Report builder (docs/03 "Reports"). Summarises progress into something the
 * user can bring to a clinician. Pure and deterministic; averages only, no
 * interpretation or diagnosis (docs/04_Clinical_Guardrails.md).
 */

export interface ProgressReport {
  generatedAt: number;
  userName: string;
  ageAtReport: number;
  periodDays: number;
  totalSessions: number;
  sessionsInPeriod: number;
  currentStreak: number;
  avgPainInPeriod: number | null;
  latestPain: number | null;
  primaryGoals: string;
  disclaimer: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const DISCLAIMER =
  "Ringkasan ini dibuat otomatis dari catatan mandiri di aplikasi. " +
  "SpineCoach AI tidak mendiagnosis dan bukan pengganti tenaga medis.";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildReport(
  user: User,
  assessment: Assessment | null,
  workoutLogs: WorkoutLog[],
  painLogs: PainLog[],
  periodDays = 30,
  now: number = Date.now()
): ProgressReport {
  const cutoff = now - periodDays * DAY_MS;
  const painInPeriod = painLogs.filter((p) => p.createdAt >= cutoff);
  const avgPain =
    painInPeriod.length > 0
      ? round1(
          painInPeriod.reduce((sum, p) => sum + p.painLevel, 0) /
            painInPeriod.length
        )
      : null;

  // painLogs arrive newest-first from the db layer.
  const latestPain = painLogs.length > 0 ? painLogs[0].painLevel : null;

  return {
    generatedAt: now,
    userName: user.name,
    ageAtReport: user.age,
    periodDays,
    totalSessions: workoutLogs.length,
    sessionsInPeriod: sessionsInLastDays(workoutLogs, periodDays, now),
    currentStreak: computeStreak(workoutLogs, now),
    avgPainInPeriod: avgPain,
    latestPain,
    primaryGoals: assessment?.primaryGoals ?? "—",
    disclaimer: DISCLAIMER,
  };
}

/** Render a report as plain text for copy/share/print. */
export function formatReportText(r: ProgressReport): string {
  const date = new Date(r.generatedAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return [
    "SpineCoach AI — Ringkasan Progres",
    `Tanggal: ${date}`,
    `Nama: ${r.userName} (${r.ageAtReport} th)`,
    "",
    `Periode: ${r.periodDays} hari terakhir`,
    `Total sesi (keseluruhan): ${r.totalSessions}`,
    `Sesi dalam periode: ${r.sessionsInPeriod}`,
    `Streak saat ini: ${r.currentStreak} hari`,
    `Rata-rata nyeri (periode): ${r.avgPainInPeriod ?? "—"}/10`,
    `Nyeri terakhir: ${r.latestPain ?? "—"}/10`,
    "",
    `Tujuan utama: ${r.primaryGoals}`,
    "",
    r.disclaimer,
  ].join("\n");
}
