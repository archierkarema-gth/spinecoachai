"use client";

import { useEffect, useState } from "react";
import { Check, Play } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCountdown } from "@/lib/use-countdown";
import { useAppStore } from "@/lib/store";
import { putKegelLog } from "@/lib/db";
import { kegelSchedule } from "@/lib/kegel-timer";
import { todayKey } from "@/lib/schroth-schemas";
import type { KegelMode } from "@/lib/log-schemas";

export default function KegelPage() {
  const { user, hydrated, hydrate } = useAppStore();
  const [mode, setMode] = useState<KegelMode>("quick");
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const steps = kegelSchedule(mode);
  const reps = mode === "quick" ? 10 : 5;
  const step = steps[index];
  const timer = useCountdown(step?.seconds ?? 0, { autoStart: false });

  // Auto-advance each step when its countdown hits 0 (timer-driven external
  // sync — legitimate setState-in-effect for a stepper).
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!running || !timer.done) return;
    if (index + 1 >= steps.length) {
      setRunning(false);
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    timer.reset(steps[index + 1].seconds);
  }, [timer.done, running]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  function startSession() {
    setDone(false);
    setSaved(false);
    setIndex(0);
    setRunning(true);
    timer.reset(steps[0].seconds);
  }

  async function saveSession() {
    if (!user || saved) return;
    await putKegelLog({
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: Date.now(),
      date: todayKey(),
      mode,
      reps,
    });
    setSaved(true);
  }

  return (
    <div>
      <TopBar title="Kegel Timer" subtitle="Dasar panggul — quick vs elevator." />
      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card>
          <CardTitle>Mode</CardTitle>
          <div className="mt-2 flex gap-2">
            {(["quick", "elevator"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={running}
                onClick={() => setMode(m)}
                className={
                  "flex-1 rounded-[var(--radius-md)] py-2 text-sm font-semibold capitalize disabled:opacity-50 " +
                  (mode === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border border-border text-foreground/70")
                }
              >
                {m === "quick" ? "Quick" : "Elevator"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {mode === "quick"
              ? "Kontraksi cepat 3s / rileks 3s × 10."
              : "Naik bertahap (2·4·6·8s), turun perlahan × 5."}
          </p>
        </Card>

        {(running || done) && step && (
          <Card className="items-center text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Langkah {Math.min(index + 1, steps.length)}/{steps.length}
            </p>
            <p className="mt-1 font-display text-xl text-card-foreground">
              {done ? "Selesai" : step.label}
            </p>
            <p className="tabular font-display text-6xl text-primary">
              {done ? "✓" : timer.remaining}
            </p>
          </Card>
        )}

        {!running && !done && (
          <Button size="lg" onClick={startSession} disabled={!user}>
            <Play size={18} /> Mulai
          </Button>
        )}

        {done && (
          <Button size="lg" onClick={saveSession} disabled={saved}>
            <Check size={18} /> {saved ? "Tersimpan" : "Simpan sesi Kegel"}
          </Button>
        )}

        <p className="px-1 text-xs text-muted-foreground">
          Perut, paha, dan glute tetap rileks. Jangan tahan napas. Hentikan bila
          dasar panggul terasa nyeri atau tegang berlebih.
        </p>
      </div>
    </div>
  );
}
