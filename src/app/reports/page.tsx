"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { getPainLogsForUser } from "@/lib/db";
import { buildReport, formatReportText } from "@/lib/report";
import type { PainLog } from "@/lib/log-schemas";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="tabular text-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

export default function ReportsPage() {
  const { hydrated, hydrate, user, latestAssessment, workoutLogs } =
    useAppStore();
  const [painLogs, setPainLogs] = useState<PainLog[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (user) getPainLogsForUser(user.id).then(setPainLogs);
  }, [user]);

  const report = useMemo(() => {
    if (!user) return null;
    return buildReport(user, latestAssessment, workoutLogs, painLogs, 30);
  }, [user, latestAssessment, workoutLogs, painLogs]);

  async function copy() {
    if (!report) return;
    await navigator.clipboard.writeText(formatReportText(report));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!report) {
    return (
      <div className="px-5 pt-10 text-sm text-muted-foreground">Memuat…</div>
    );
  }

  return (
    <div>
      <TopBar
        title="Reports"
        subtitle="Ringkasan 30 hari untuk dibawa ke dokter/fisioterapis."
      />

      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card>
          <CardTitle>Ringkasan progres</CardTitle>
          <Row label="Nama" value={`${report.userName} (${report.ageAtReport} th)`} />
          <Row label="Total sesi" value={String(report.totalSessions)} />
          <Row label="Sesi 30 hari" value={String(report.sessionsInPeriod)} />
          <Row label="Streak" value={`${report.currentStreak} hari`} />
          <Row
            label="Rata-rata nyeri"
            value={
              report.avgPainInPeriod !== null
                ? `${report.avgPainInPeriod}/10`
                : "—"
            }
          />
          <Row
            label="Nyeri terakhir"
            value={report.latestPain !== null ? `${report.latestPain}/10` : "—"}
          />
        </Card>

        <Card>
          <CardTitle>Tujuan utama</CardTitle>
          <p className="text-sm text-foreground">{report.primaryGoals}</p>
        </Card>

        <Button onClick={copy}>
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? "Tersalin" : "Salin sebagai teks"}
        </Button>

        <p className="px-1 text-xs text-muted-foreground">{report.disclaimer}</p>
      </div>
    </div>
  );
}
