"use client";

import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import { useAppStore } from "@/lib/store";
import { getPainLogsForUser } from "@/lib/db";
import {
  computeStreak,
  sessionsInLastDays,
  painTrend,
} from "@/lib/progress";
import type { PainLog } from "@/lib/log-schemas";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export default function ProgressPage() {
  const { hydrated, hydrate, user, workoutLogs } = useAppStore();
  const [painLogs, setPainLogs] = useState<PainLog[]>([]);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (user) getPainLogsForUser(user.id).then(setPainLogs);
  }, [user]);

  const streak = useMemo(() => computeStreak(workoutLogs), [workoutLogs]);
  const week = useMemo(
    () => sessionsInLastDays(workoutLogs, 7),
    [workoutLogs]
  );
  const trend = useMemo(
    () => painTrend(painLogs, workoutLogs),
    [painLogs, workoutLogs]
  );

  return (
    <div>
      <TopBar title="Progress" subtitle="Konsistensi dan tren dari waktu ke waktu." />

      <div className="flex flex-col gap-4 px-5 pb-8">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardTitle>Streak</CardTitle>
            <p className="tabular font-display text-3xl text-primary-deep">
              {streak}
              <span className="ml-1 text-sm font-sans text-muted-foreground">
                hari
              </span>
            </p>
          </Card>
          <Card>
            <CardTitle>Sesi 7 hari</CardTitle>
            <p className="tabular font-display text-3xl text-primary-deep">
              {week}
            </p>
          </Card>
        </div>

        <Card>
          <CardTitle>Tren nyeri</CardTitle>
          <Sparkline values={trend.map((t) => t.painLevel)} />
          {trend.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Terakhir: {trend[trend.length - 1].painLevel}/10
            </p>
          )}
        </Card>

        <section>
          <CardTitle>Sesi terakhir</CardTitle>
          {workoutLogs.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">
                Belum ada sesi selesai. Setelah menyelesaikan latihan, riwayat
                muncul di sini.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {workoutLogs.slice(0, 10).map((log) => (
                <Card key={log.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {log.movementFocus}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground capitalize">
                    {log.intensity} · {log.exercises.length} gerakan ·{" "}
                    {log.estimatedMinutes} mnt
                  </p>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
