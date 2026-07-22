"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { getAllExercises } from "@/lib/db";
import type { Exercise } from "@/lib/exercise-schemas";

/**
 * Schroth Pose Library (spec §9.6). Reads the schroth-category exercises from
 * the library — breathing directions are authored (safe geometry), while
 * strengthen/stretch/rotation SIDE stays PENDING_PT with a clear badge.
 */
export default function PosesPage() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);

  useEffect(() => {
    getAllExercises().then(setExercises);
  }, []);

  const poses = (exercises ?? []).filter((e) => e.category === "schroth");

  return (
    <div>
      <TopBar
        title="Schroth Pose Library"
        subtitle="Napas & korektif — arah aman diautorisasi, sisi menunggu PT."
      />
      <div className="flex flex-col gap-3 px-5 pb-8">
        {exercises === null ? (
          <p className="text-sm text-foreground/60">Memuat…</p>
        ) : poses.length === 0 ? (
          <p className="text-sm text-foreground/60">Belum ada pose.</p>
        ) : (
          poses.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="mb-0">{p.name}</CardTitle>
                {p.schrothCuePendingPT && (
                  <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
                    sisi PENDING PT
                  </span>
                )}
              </div>
              {p.schrothCue && (
                <p className="mt-1 rounded-[var(--radius-md)] bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary">
                  {p.schrothCue}
                </p>
              )}
              {p.cues.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {p.cues.map((c) => (
                    <li key={c} className="text-xs text-card-foreground">
                      • {c}
                    </li>
                  ))}
                </ul>
              )}
              {p.mirrorCheckRequired && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Disarankan mirror check saat melakukan pose ini.
                </p>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
