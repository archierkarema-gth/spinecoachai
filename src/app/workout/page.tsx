"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import {
  getAllExercises,
  getSessionLogsForUser,
  putAsymmetryLog,
  putSessionLog,
  putWorkoutLog,
} from "@/lib/db";
import type { Exercise, SideEmphasis } from "@/lib/exercise-schemas";
import type {
  CompletedExercise,
  NewAsymmetryLogInput,
  NewSessionLogInput,
  SessionLog,
} from "@/lib/log-schemas";
import { hasRedFlag } from "@/lib/schemas";
import { resolveToday, type ResolvedDay } from "@/lib/split";
import { SessionPlayer } from "@/components/workout/session-player";
import { SessionLogForm } from "@/components/workout/session-log-form";
import { equipmentBadges } from "@/lib/equipment-label";

const SIDE_LABEL: Record<SideEmphasis, string> = {
  bilateral: "Kiri + kanan",
  left: "Sisi kiri",
  right: "Sisi kanan",
};

type Phase = "preview" | "playing" | "logging";

/** Rough minute estimate: bilateral moves run two phases. */
function estimateMinutes(day: ResolvedDay): number {
  let s = 0;
  for (const b of day.blocks)
    for (const ex of b.exercises)
      s += ex.durationSeconds * (ex.sideEmphasis === "bilateral" ? 2 : 1);
  return Math.round(s / 60);
}

export default function WorkoutPage() {
  const router = useRouter();
  const { hydrated, hydrate, latestAssessment, user, refreshLogs, refreshM16Logs } =
    useAppStore();
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [phase, setPhase] = useState<Phase>("preview");
  const [completed, setCompleted] = useState<CompletedExercise[]>([]);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    getAllExercises().then(setExercises);
  }, []);

  useEffect(() => {
    if (user) getSessionLogsForUser(user.id).then(setSessionLogs);
  }, [user]);

  const day: ResolvedDay | null = useMemo(() => {
    if (!exercises) return null;
    return resolveToday(exercises, sessionLogs);
  }, [exercises, sessionLogs]);

  // Distinct exercises across the day, order preserved — for player + log form.
  const distinctExercises = useMemo(() => {
    if (!day) return [];
    const seen = new Set<string>();
    const out: Exercise[] = [];
    for (const b of day.blocks)
      for (const ex of b.exercises)
        if (!seen.has(ex.id)) {
          seen.add(ex.id);
          out.push(ex);
        }
    return out;
  }, [day]);

  async function persist(payload: {
    logs: NewSessionLogInput[];
    asymmetry: NewAsymmetryLogInput | null;
  }) {
    if (!user || !day) return;
    const now = Date.now();
    await Promise.all(
      payload.logs.map((l) =>
        putSessionLog({
          ...l,
          userId: user.id,
          id: crypto.randomUUID(),
          createdAt: now,
        })
      )
    );
    if (payload.asymmetry) {
      await putAsymmetryLog({
        ...payload.asymmetry,
        userId: user.id,
        id: crypto.randomUUID(),
        createdAt: now,
        reviewed: false,
      });
    }
    // Keep a WorkoutLog too so progress/report history stays intact.
    await putWorkoutLog({
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: now,
      movementFocus: day.title,
      intensity: "split",
      estimatedMinutes: estimateMinutes(day),
      exercises: completed,
    });
    await Promise.all([refreshLogs(), refreshM16Logs()]);
    router.push("/progress");
  }

  if (!hydrated || !exercises || !day) {
    return <div className="px-5 pt-10 text-sm text-foreground/60">Memuat…</div>;
  }

  if (!latestAssessment) {
    return (
      <div className="px-5 pt-6">
        <Card>
          <p className="text-sm text-muted-foreground">Isi asesmen awal dulu.</p>
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

  // Safety still wins: red flags route to medical review, never a session.
  if (hasRedFlag(latestAssessment.redFlags)) {
    return (
      <div className="px-5 pt-6">
        <Card className="border-destructive bg-destructive/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-destructive" size={20} />
            <div>
              <p className="font-semibold text-foreground">Perlu tinjauan medis</p>
              <p className="mt-1 text-sm text-foreground/60">
                Asesmen menandai gejala yang perlu dicek tenaga medis dulu.
                SpineCoach tidak menyusun latihan sampai itu ditangani.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (day.isRest) {
    return (
      <div>
        <TopBar title="Hari ini" subtitle="Istirahat / deload" />
        <div className="px-5 pb-8">
          <Card>
            <CardTitle>Hari istirahat</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Minggu = pemulihan. Split kembali Senin. Boleh Schroth ringan +
              mobility bila mau.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (phase === "playing") {
    const blocks = day.blocks.map((b) => ({ label: b.label, exercises: b.exercises }));
    return (
      <SessionPlayer
        blocks={blocks}
        onFinish={(c) => {
          setCompleted(c);
          setPhase("logging");
        }}
        onExit={() => setPhase("preview")}
      />
    );
  }

  if (phase === "logging") {
    return <SessionLogForm exercises={distinctExercises} onSave={persist} />;
  }

  return (
    <div>
      <TopBar title="Sesi hari ini" subtitle={day.title} />

      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card className="bg-primary text-primary-foreground border-transparent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-80">Fokus</p>
              <p className="font-display text-lg">{day.focus}</p>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Clock size={16} />
              <span className="tabular">± {estimateMinutes(day)} mnt</span>
            </div>
          </div>
        </Card>

        {day.blocks.map((block, i) => (
          <Card key={`${block.kind}-${i}`}>
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
                    <span className="tabular text-xs text-foreground/60">
                      {ex.holdSeconds != null
                        ? `${ex.holdSeconds}s tahan`
                        : ex.repTargetMax != null
                          ? `${ex.repTargetMin ?? "?"}–${ex.repTargetMax} reps`
                          : `${ex.durationSeconds}s`}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {/* On the inner bg-background box (not bg-card), text-primary
                        is tuned for the outer card in light mode and washes out
                        here — text-foreground/80 stays legible in both modes. */}
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                      {SIDE_LABEL[ex.sideEmphasis]}
                    </span>
                    {ex.schrothCuePendingPT && (
                      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                        sisi PENDING PT
                      </span>
                    )}
                    {equipmentBadges(ex.equipment).map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  {(ex.schrothCue || ex.cues.length > 0) && (
                    <p className="mt-1.5 text-xs text-foreground/60">
                      {[ex.schrothCue, ...ex.cues].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              ))}
              {block.missing.length > 0 && (
                <p className="text-xs text-destructive">
                  Gerakan belum ada di library: {block.missing.join(", ")}
                </p>
              )}
            </div>
          </Card>
        ))}

        <Button size="lg" onClick={() => setPhase("playing")} disabled={!user}>
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
