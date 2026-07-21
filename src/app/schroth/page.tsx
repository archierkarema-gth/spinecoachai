"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BreathingCircle } from "@/components/schroth/breathing-circle";
import { useCountdown } from "@/lib/use-countdown";
import { useAppStore } from "@/lib/store";
import { getSchrothLogForDate, putSchrothLog } from "@/lib/db";
import { SCHROTH_SEED } from "@/lib/schroth-seed";
import { todayKey } from "@/lib/schroth-schemas";
import type { SchrothLog } from "@/lib/schroth-schemas";

export default function SchrothPage() {
  const { user, hydrated, hydrate } = useAppStore();
  const [log, setLog] = useState<SchrothLog | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!user) return;
    getSchrothLogForDate(user.id, todayKey()).then((l) => setLog(l ?? null));
  }, [user]);

  const completedIds = log?.completedIds ?? [];
  const done = completedIds.length;
  const total = SCHROTH_SEED.length;

  async function markDone(exerciseId: string) {
    if (!user) return;
    const dateKey = todayKey();
    const next = Array.from(new Set([...(log?.completedIds ?? []), exerciseId]));
    const updated: SchrothLog = {
      id: log?.id ?? `${user.id}_${dateKey}`,
      userId: user.id,
      dateKey,
      completedIds: next,
      updatedAt: Date.now(),
    };
    await putSchrothLog(updated);
    setLog(updated);
    setOpenId(null);
  }

  const openExercise = SCHROTH_SEED.find((e) => e.id === openId) ?? null;

  if (openExercise) {
    return (
      <SchrothDetail
        exercise={openExercise}
        alreadyDone={completedIds.includes(openExercise.id)}
        onClose={() => setOpenId(null)}
        onDone={() => markDone(openExercise.id)}
      />
    );
  }

  return (
    <div>
      <TopBar
        title="Schroth"
        subtitle="Napas korektif harian — 6 gerakan, mandiri, offline."
      />

      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Schroth hari ini</CardTitle>
            <span className="tabular text-sm font-semibold text-primary-deep">
              {done}/{total}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>
        </Card>

        <div className="flex flex-col gap-2">
          {SCHROTH_SEED.map((ex) => {
            const isDone = completedIds.includes(ex.id);
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => setOpenId(ex.id)}
                className="text-left"
              >
                <Card className="flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        "flex size-8 shrink-0 items-center justify-center rounded-full " +
                        (isDone
                          ? "bg-success/20 text-success"
                          : "bg-primary/10 text-primary")
                      }
                    >
                      {isDone ? <Check size={16} /> : null}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {ex.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ex.breaths}x napas · ~{Math.round(ex.durationSeconds / 60)} mnt
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground" />
                </Card>
              </button>
            );
          })}
        </div>

        <p className="px-1 text-xs text-muted-foreground">
          Napas diarahkan berdasarkan kesadaran tubuhmu sendiri, bukan hitungan
          klinis dari aplikasi. Ikuti arahan fisioterapis/dokter kalau ada.
          Hentikan jika pusing atau nyeri.
        </p>
      </div>
    </div>
  );
}

function SchrothDetail({
  exercise,
  alreadyDone,
  onClose,
  onDone,
}: {
  exercise: (typeof SCHROTH_SEED)[number];
  alreadyDone: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const timer = useCountdown(exercise.durationSeconds, { autoStart: true });
  const breathSeconds = Math.max(
    2,
    Math.round(exercise.durationSeconds / exercise.breaths)
  );

  return (
    <div className="flex flex-col gap-4 px-5 pb-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-muted-foreground"
        >
          <X size={16} className="inline" /> Tutup
        </button>
        <span className="tabular text-xs font-medium text-muted-foreground">
          {timer.remaining}s tersisa
        </span>
      </div>

      <Card>
        <CardTitle>{exercise.name}</CardTitle>
        <p className="text-sm text-muted-foreground">{exercise.position}</p>
      </Card>

      <BreathingCircle breathSeconds={breathSeconds} running={timer.running} />

      <Card>
        <p className="text-sm text-foreground">{exercise.description}</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {exercise.cues.map((c) => (
            <li key={c} className="text-sm text-foreground">
              • {c}
            </li>
          ))}
        </ul>
        {exercise.contraindications.length > 0 && (
          <p className="mt-2 text-xs text-warning">
            Hindari jika: {exercise.contraindications.join(", ")}
          </p>
        )}
      </Card>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => (timer.running ? timer.pause() : timer.start())}
        >
          {timer.running ? "Jeda" : "Lanjutkan"}
        </Button>
        <Button className="flex-1" onClick={onDone}>
          <Check size={16} />
          {alreadyDone ? "Tandai lagi selesai" : "Selesai"}
        </Button>
      </div>
    </div>
  );
}
