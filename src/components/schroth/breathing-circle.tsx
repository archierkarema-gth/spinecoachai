"use client";

import { useEffect, useState } from "react";

/**
 * Visual breathing guide: a circle that expands on inhale and contracts on
 * exhale, cycle length derived from the exercise's own duration/breaths (so
 * a 180s/10-breath exercise cycles slower than a 90s/6-breath one — no
 * hardcoded pace). Label toggles independently on the half-cycle so it stays
 * readable even though the CSS ease-in-out curve isn't perfectly linear.
 */
export function BreathingCircle({
  breathSeconds,
  running,
}: {
  breathSeconds: number;
  running: boolean;
}) {
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    if (!running) return;
    const halfMs = (breathSeconds * 1000) / 2;
    // Don't force phase to "in" here (would be a synchronous setState in the
    // effect body) — resuming after a pause just continues the current
    // phase, which is fine visually since the interval below re-syncs it.
    const id = setInterval(() => {
      setPhase((p) => (p === "in" ? "out" : "in"));
    }, halfMs);
    return () => clearInterval(id);
  }, [running, breathSeconds]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6">
      <div
        className="schroth-breathing-circle flex size-40 items-center justify-center rounded-full bg-primary/20 text-primary"
        style={
          {
            "--breath-seconds": `${breathSeconds}s`,
            animationPlayState: running ? "running" : "paused",
          } as React.CSSProperties
        }
      >
        <div className="flex size-24 items-center justify-center rounded-full bg-primary/30 text-sm font-semibold text-[color:var(--breathing-label)]">
          {phase === "in" ? "Tarik napas" : "Buang napas"}
        </div>
      </div>
      <p className="text-xs text-foreground/60">
        Ikuti lingkaran: membesar = tarik napas, mengecil = buang napas.
      </p>
    </div>
  );
}
