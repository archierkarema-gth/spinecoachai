"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipForward, Check, X, Volume2, VolumeX } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScalePicker } from "@/components/ui/scale-picker";
import { useCountdown } from "@/lib/use-countdown";
import { beepForSecond, playCue, isBeepMuted, setBeepMuted } from "@/lib/use-beep";
import {
  buildSteps,
  toCompletedExercises,
  type PhaseStatus,
} from "@/lib/session-player";
import type { GeneratedSession } from "@/lib/decision-engine";
import type { CompletedExercise } from "@/lib/log-schemas";

const SIDE_LABEL: Record<string, string> = {
  left: "Sisi kiri",
  right: "Sisi kanan",
  bilateral: "Kiri + kanan",
};

export function SessionPlayer({
  session,
  onFinish,
  onExit,
}: {
  session: GeneratedSession;
  onFinish: (r: { completed: CompletedExercise[]; postSessionPain: number }) => void;
  onExit: () => void;
}) {
  const steps = useMemo(() => buildSteps(session), [session]);
  const [index, setIndex] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, PhaseStatus>>({});
  // Start already in the summary when there is nothing to play (empty session).
  const [showSummary, setShowSummary] = useState(steps.length === 0);
  const [pain, setPain] = useState(2);

  const step = steps[index];
  const timer = useCountdown(step?.seconds ?? 0, { autoStart: true });

  const [muted, setMuted] = useState(isBeepMuted);
  const lastBeepedSecond = useRef<number | null>(null);

  useEffect(() => {
    if (!timer.running) {
      lastBeepedSecond.current = null;
      return;
    }
    if (lastBeepedSecond.current === timer.remaining) return;
    lastBeepedSecond.current = timer.remaining;
    const cue = beepForSecond(timer.remaining);
    if (cue) playCue(cue);
  }, [timer.running, timer.remaining]);

  // Rest auto-advances when its countdown hits 0; exercise phases never
  // auto-advance (hybrid timing — they wait for a tap).
  useEffect(() => {
    if (step?.kind === "rest" && timer.done) goNext();
    // goNext is stable enough for this guard; deps intentionally minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, timer.done]);

  const totalExerciseSteps = steps.filter((s) => s.kind === "exercise").length;
  const doneExerciseSteps = steps
    .slice(0, index)
    .filter((s) => s.kind === "exercise").length;

  function goNext() {
    if (index + 1 >= steps.length) {
      timer.pause();
      setShowSummary(true);
    } else {
      setIndex((i) => i + 1);
      timer.reset(steps[index + 1].seconds);
    }
  }

  function markAndNext(status: PhaseStatus) {
    if (step.kind === "exercise") {
      setStatuses((s) => ({ ...s, [step.phaseId]: status }));
    }
    goNext();
  }

  if (showSummary) {
    return (
      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card>
          <CardTitle>Sesi selesai</CardTitle>
          <p className="mb-3 text-sm text-muted-foreground">
            Gimana nyeri kamu setelah sesi ini?
          </p>
          <ScalePicker
            value={pain}
            onChange={setPain}
            min={0}
            max={10}
            lowLabel="Tidak nyeri"
            highLabel="Sangat nyeri"
          />
        </Card>
        <Button
          size="lg"
          onClick={() =>
            onFinish({
              completed: toCompletedExercises(session, statuses),
              postSessionPain: pain,
            })
          }
        >
          <Check size={18} /> Simpan sesi
        </Button>
        <p className="px-1 text-xs text-muted-foreground">
          SpineCoach AI bukan pengganti dokter atau fisioterapis. Hentikan
          gerakan yang menimbulkan nyeri tajam.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-8">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {Math.min(doneExerciseSteps + 1, totalExerciseSteps)} / {totalExerciseSteps}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={muted ? "Bunyikan hitung mundur" : "Bisukan hitung mundur"}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setBeepMuted(next);
            }}
            className="text-muted-foreground"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="text-xs font-semibold text-muted-foreground"
          >
            Keluar
          </button>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${totalExerciseSteps ? (doneExerciseSteps / totalExerciseSteps) * 100 : 0}%` }}
        />
      </div>

      {step.kind === "rest" ? (
        <Card className="items-center text-center">
          <CardTitle>Istirahat</CardTitle>
          <p className="font-display text-5xl tabular text-primary">
            {timer.remaining}
          </p>
          <Button variant="outline" className="mt-4" onClick={goNext}>
            <SkipForward size={16} /> Lewati
          </Button>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>{step.exercise.name}</CardTitle>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {SIDE_LABEL[step.side ?? step.exercise.sideEmphasis]}
              </span>
            </div>
            <p
              className={
                "font-display text-6xl tabular " +
                (timer.done ? "text-success" : "text-foreground")
              }
            >
              {timer.remaining}
            </p>
            {step.exercise.cues.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {step.exercise.cues.join(" · ")}
              </p>
            )}
          </Card>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => (timer.running ? timer.pause() : timer.start())}
            >
              {timer.running ? <Pause size={16} /> : <Play size={16} />}
              {timer.running ? "Jeda" : "Lanjutkan"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => markAndNext("skipped")}
            >
              <X size={16} /> Lewati
            </Button>
          </div>
          <Button size="lg" onClick={() => markAndNext("done")}>
            <Check size={18} /> Lanjut
          </Button>
        </>
      )}
    </div>
  );
}
