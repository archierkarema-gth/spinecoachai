"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PATTERN,
  phaseAt,
  completedCycles,
  type BreathPhase,
} from "@/lib/breathing-timer";

const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: "Tarik napas",
  hold: "Tahan",
  exhale: "Buang napas",
  rest: "Jeda",
};

const PHASE_SCALE: Record<BreathPhase, string> = {
  inhale: "scale-100",
  hold: "scale-100",
  exhale: "scale-50",
  rest: "scale-50",
};

export default function BreathingPage() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [running]);

  const state = phaseAt(DEFAULT_PATTERN, elapsed);
  const cycles = completedCycles(DEFAULT_PATTERN, elapsed);

  return (
    <div>
      <TopBar
        title="Breathing Counter"
        subtitle="Pacer napas Schroth — tarik/tahan/buang."
      />
      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card className="items-center text-center">
          <div className="flex h-56 w-full items-center justify-center">
            <div
              className={
                "flex size-40 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform duration-1000 ease-in-out " +
                (running ? PHASE_SCALE[state.phase] : "scale-75")
              }
            >
              <div>
                <p className="font-display text-2xl">{PHASE_LABEL[state.phase]}</p>
                <p className="tabular text-4xl font-display">{state.secondsLeft}</p>
              </div>
            </div>
          </div>
          <p className="tabular text-sm text-muted-foreground">
            Siklus napas: {cycles}
          </p>
        </Card>

        <Card>
          <CardTitle>Pola</CardTitle>
          <p className="text-sm text-card-foreground">
            Tarik {DEFAULT_PATTERN.inhale}s · Tahan {DEFAULT_PATTERN.hold}s · Buang{" "}
            {DEFAULT_PATTERN.exhale}s
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Arah napas (sisi konkaf) ikuti gerakan Schroth-mu — pacer ini hanya
            mengatur ritme, bukan arah.
          </p>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setRunning((r) => !r)}
          >
            {running ? <Pause size={16} /> : <Play size={16} />}
            {running ? "Jeda" : "Mulai"}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setRunning(false);
              setElapsed(0);
            }}
          >
            <RotateCcw size={16} /> Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
