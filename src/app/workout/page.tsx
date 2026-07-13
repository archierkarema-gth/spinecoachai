"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { getAllExercises, putWorkoutLog } from "@/lib/db";
import {
  generateSession,
  type GeneratedSession,
} from "@/lib/decision-engine";
import type { Exercise, SideEmphasis } from "@/lib/exercise-schemas";
import { SessionPlayer } from "@/components/workout/session-player";
import { equipmentBadges } from "@/lib/equipment-label";
import type { CompletedExercise } from "@/lib/log-schemas";

const SIDE_LABEL: Record<SideEmphasis, string> = {
  bilateral: "Kiri + kanan",
  left: "Sisi kiri",
  right: "Sisi kanan",
};

export default function WorkoutPage() {
  const router = useRouter();
  const {
    hydrated,
    hydrate,
    latestAssessment,
    latestCheckIn,
    workoutLogs,
    user,
    refreshLogs,
  } = useAppStore();
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    getAllExercises().then(setExercises);
  }, []);

  const session: GeneratedSession | null = useMemo(() => {
    if (!latestAssessment || !latestCheckIn || !exercises) return null;
    return generateSession({
      assessment: latestAssessment,
      checkIn: latestCheckIn,
      exercises,
      recentSessionTimestamps: workoutLogs.map((l) => l.createdAt),
      // Feeds deriveCapability so completed sessions ratchet difficulty over time.
      workoutLogs,
      preset: user?.trainingPreset ?? "balanced",
      ownedEquipment: user?.ownedEquipment ?? [],
    });
  }, [latestAssessment, latestCheckIn, exercises, workoutLogs, user]);

  async function finishSession(result: {
    completed: CompletedExercise[];
    postSessionPain: number;
  }) {
    if (!user || !session) return;
    await putWorkoutLog({
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: Date.now(),
      movementFocus: session.movementFocus,
      intensity: session.intensity,
      estimatedMinutes: session.estimatedMinutes,
      exercises: result.completed,
      postSessionPain: result.postSessionPain,
    });
    await refreshLogs();
    router.push("/progress");
  }

  if (!hydrated || !exercises) {
    return (
      <div className="px-5 pt-10 text-sm text-muted-foreground">Memuat…</div>
    );
  }

  if (!latestAssessment) {
    return (
      <div className="px-5 pt-6">
        <Card>
          <p className="text-sm text-muted-foreground">
            Isi asesmen awal dulu.
          </p>
          <Link
            href="/assessment"
            className="mt-3 inline-block text-sm font-semibold text-primary"
          >
            Ke asesmen awal →
          </Link>
        </Card>
      </div>
    );
  }

  if (!latestCheckIn) {
    return (
      <div className="px-5 pt-6">
        <Card>
          <CardTitle>Belum check-in</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sesi disusun dari kondisi kamu hari ini. Check-in dulu.
          </p>
          <Link href="/checkin">
            <Button className="mt-4 w-full">Mulai check-in harian</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (session?.escalated) {
    return (
      <div className="px-5 pt-6">
        <Card className="border-destructive bg-destructive/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-destructive" size={20} />
            <div>
              <p className="font-semibold text-foreground">
                {session.movementFocus}
              </p>
              {session.reasoning.map((r) => (
                <p key={r} className="mt-1 text-sm text-muted-foreground">
                  {r}
                </p>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!session) return null;

  if (playing) {
    return (
      <SessionPlayer
        session={session}
        onFinish={finishSession}
        onExit={() => setPlaying(false)}
      />
    );
  }

  return (
    <div>
      <TopBar title="Sesi hari ini" subtitle={session.movementFocus} />

      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card className="bg-primary text-primary-foreground border-transparent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-80">
                Intensitas
              </p>
              <p className="font-display text-lg capitalize">
                {session.intensity}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Clock size={16} />
              <span className="tabular">± {session.estimatedMinutes} mnt</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Kenapa sesi ini</CardTitle>
          <ul className="flex flex-col gap-1.5">
            {session.reasoning.map((r) => (
              <li key={r} className="text-sm text-foreground">
                • {r}
              </li>
            ))}
          </ul>
        </Card>

        {session.blocks.map((block) => (
          <Card key={block.domain}>
            <CardTitle>{block.label}</CardTitle>
            <div className="flex flex-col gap-2">
              {block.exercises.map((ex) => (
                <div
                  key={ex.id}
                  className="rounded-[var(--radius-md)] border border-border bg-background p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {ex.name}
                    </span>
                    <span className="tabular text-xs text-muted-foreground">
                      {ex.durationSeconds}s
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {SIDE_LABEL[ex.sideEmphasis]}
                    </span>
                    {equipmentBadges(ex.equipment).map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  {ex.cues.length > 0 && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {ex.cues.join(" · ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}

        <Button size="lg" onClick={() => setPlaying(true)} disabled={!user}>
          Mulai sesi
        </Button>

        <p className="px-1 text-xs text-muted-foreground">
          SpineCoach AI bukan pengganti dokter atau fisioterapis. Hentikan
          gerakan yang menimbulkan nyeri tajam.
        </p>
      </div>
    </div>
  );
}
