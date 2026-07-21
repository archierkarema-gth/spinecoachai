"use client";

import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { getPainLogsForUser, putBenchmarkLog } from "@/lib/db";
import {
  computeStreak,
  sessionsInLastDays,
  painTrend,
  latestBenchmark,
  personalBest,
  benchmarkTrend,
  weeklyVolumeByDomain,
} from "@/lib/progress";
import type { PainLog, BenchmarkLog } from "@/lib/log-schemas";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

const DOMAIN_LABELS: Record<string, string> = {
  breathing: "Napas",
  mobility: "Mobilitas",
  stability: "Stabilitas",
  core: "Core",
  balance: "Keseimbangan",
  strength: "Kekuatan",
  conditioning: "Kondisi",
  recovery: "Pendinginan",
};

export default function ProgressPage() {
  const { hydrated, hydrate, user, workoutLogs, benchmarkLogs, refreshBenchmarks } = useAppStore();
  const [painLogs, setPainLogs] = useState<PainLog[]>([]);
  const [plankSeconds, setPlankSeconds] = useState("");
  const [plankNote, setPlankNote] = useState("");
  const [savingPlank, setSavingPlank] = useState(false);

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
  const volumeByDomain = useMemo(
    () => weeklyVolumeByDomain(workoutLogs),
    [workoutLogs]
  );
  const trend = useMemo(
    () => painTrend(painLogs, workoutLogs),
    [painLogs, workoutLogs]
  );
  const plankLatest = useMemo(
    () => latestBenchmark(benchmarkLogs, "plank_hold"),
    [benchmarkLogs]
  );
  const plankBest = useMemo(
    () => personalBest(benchmarkLogs, "plank_hold"),
    [benchmarkLogs]
  );
  const plankTrend = useMemo(
    () => benchmarkTrend(benchmarkLogs, "plank_hold"),
    [benchmarkLogs]
  );
  const plankTrendMax = useMemo(
    () => Math.max(60, ...plankTrend.map((p) => p.value)),
    [plankTrend]
  );

  async function onSavePlank() {
    if (!user) return;
    const seconds = Number(plankSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    setSavingPlank(true);
    const log: BenchmarkLog = {
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: Date.now(),
      type: "plank_hold",
      value: seconds,
      note: plankNote || undefined,
    };
    await putBenchmarkLog(log);
    await refreshBenchmarks();
    setPlankSeconds("");
    setPlankNote("");
    setSavingPlank(false);
  }

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

        <Card>
          <CardTitle>Volume 7 hari per domain</CardTitle>
          <div className="mt-2 flex flex-col gap-1">
            {Object.entries(volumeByDomain).map(([domain, minutes]) => (
              <div
                key={domain}
                className="flex items-center justify-between text-sm text-card-foreground"
              >
                <span>{DOMAIN_LABELS[domain] ?? domain}</span>
                <span className="tabular text-muted-foreground">
                  {Math.round(minutes)} mnt
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Tes plank</CardTitle>
          {plankLatest === null ? (
            <p className="text-sm text-muted-foreground">
              Belum ada tes plank tercatat.
            </p>
          ) : (
            <div className="flex items-baseline gap-3">
              <p className="tabular font-display text-3xl text-primary-deep">
                {plankLatest}
                <span className="ml-1 text-sm font-sans text-muted-foreground">
                  detik
                </span>
              </p>
              {plankBest !== null && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                  PB {plankBest}s
                </span>
              )}
            </div>
          )}
          {plankTrend.length > 0 && (
            <div className="mt-2">
              <Sparkline
                values={plankTrend.map((p) => p.value)}
                max={plankTrendMax}
                ariaLabel={`Tren plank, terakhir ${plankLatest} detik`}
              />
            </div>
          )}
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="plank-seconds">Catat tes (detik)</Label>
                <Input
                  id="plank-seconds"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="mis. 45"
                  value={plankSeconds}
                  onChange={(e) => setPlankSeconds(e.target.value)}
                />
              </div>
              <Button onClick={onSavePlank} disabled={savingPlank || !user || !plankSeconds}>
                {savingPlank ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>
            <div>
              <Label htmlFor="plank-note">Catatan (opsional)</Label>
              <Textarea
                id="plank-note"
                placeholder="mis. terasa lebih stabil"
                value={plankNote}
                onChange={(e) => setPlankNote(e.target.value)}
              />
            </div>
          </div>
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
                    <span className="text-sm font-semibold text-card-foreground">
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
