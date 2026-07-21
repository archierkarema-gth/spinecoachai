"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wind } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReminderBanner } from "@/components/dashboard/reminder-banner";
import { useAppStore } from "@/lib/store";
import { putUser, getSchrothLogForDate } from "@/lib/db";
import { computeStreak, sessionsInLastDays } from "@/lib/progress";
import { SCHROTH_SEED } from "@/lib/schroth-seed";
import { todayKey } from "@/lib/schroth-schemas";

// Personal-use MVP (docs/01_Project_Charter.md): single local user, seeded
// on first load so the assessment can attach to a userId immediately.
async function ensureUser() {
  const { user, setUser } = useAppStore.getState();
  if (user) return;
  const seeded = {
    id: crypto.randomUUID(),
    name: "Archie",
    age: 32,
    createdAt: Date.now(),
    trainingPreset: "balanced" as const,
    ownedEquipment: [],
  };
  await putUser(seeded);
  setUser(seeded);
}

export default function DashboardPage() {
  const { hydrated, user, latestAssessment, workoutLogs, hydrate } =
    useAppStore();

  const streak = useMemo(() => computeStreak(workoutLogs), [workoutLogs]);
  const week = useMemo(() => sessionsInLastDays(workoutLogs, 7), [workoutLogs]);
  const [schrothDone, setSchrothDone] = useState(0);

  useEffect(() => {
    hydrate().then(ensureUser);
  }, [hydrate]);

  useEffect(() => {
    if (!user) return;
    getSchrothLogForDate(user.id, todayKey()).then((log) =>
      setSchrothDone(log?.completedIds.length ?? 0)
    );
  }, [user]);

  if (!hydrated) {
    return (
      <div className="px-5 pt-10 text-sm text-muted-foreground">
        Memuat…
      </div>
    );
  }

  return (
    <div>
      <TopBar
        title={`Halo, ${user?.name ?? "Archie"}`}
        subtitle="Dashboard — ringkasan latihan & postur kamu."
      />

      <div className="flex flex-col gap-4 px-5">
        <ReminderBanner />
        {!latestAssessment ? (
          <Card className="bg-primary text-primary-foreground border-transparent">
            <CardTitle className="text-primary-foreground/70">
              Mulai di sini
            </CardTitle>
            <p className="text-sm mb-3">
              Isi asesmen awal dulu supaya SpineCoach bisa mulai menyusun
              program latihan yang aman buat kamu.
            </p>
            <Link href="/assessment">
              <Button variant="default" className="w-full">
                Mulai asesmen awal
              </Button>
            </Link>
          </Card>
        ) : (
          <Card>
            <CardTitle>Asesmen terakhir</CardTitle>
            <p className="text-sm text-foreground">
              Nyeri {latestAssessment.painLevel}/10 · Level aktivitas{" "}
              {latestAssessment.activityLevel} ·{" "}
              {latestAssessment.availableMinutesPerDay} menit/hari
            </p>
            <Link
              href="/assessment"
              className="mt-3 inline-block text-xs font-semibold text-primary"
            >
              Isi ulang asesmen →
            </Link>
          </Card>
        )}

        {latestAssessment && (
          <Card className="bg-accent text-accent-foreground border-transparent">
            <CardTitle className="text-accent-foreground/70">
              Sesi hari ini
            </CardTitle>
            <p className="text-sm mb-3">
              Check-in dulu biar SpineCoach nyusun latihan sesuai kondisi kamu
              hari ini.
            </p>
            <Link href="/checkin">
              <Button
                variant="outline"
                className="w-full border-accent-foreground/30 text-accent-foreground"
              >
                Mulai check-in harian
              </Button>
            </Link>
          </Card>
        )}

        <Link href="/schroth">
          <Card className="flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wind size={18} />
              </div>
              <div>
                <CardTitle className="mb-0">Schroth hari ini</CardTitle>
                <p className="tabular text-sm font-semibold text-foreground">
                  {schrothDone}/{SCHROTH_SEED.length} gerakan
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/progress">
          <Card className="grid grid-cols-2 gap-3">
            <div>
              <CardTitle>Streak</CardTitle>
              <p className="tabular font-display text-3xl text-primary-deep">
                {streak}
                <span className="ml-1 text-sm font-sans text-muted-foreground">
                  hari
                </span>
              </p>
            </div>
            <div>
              <CardTitle>Sesi 7 hari</CardTitle>
              <p className="tabular font-display text-3xl text-primary-deep">
                {week}
              </p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
