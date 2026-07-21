"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { getAllExercises, syncSeedExercises } from "@/lib/db";
import type {
  Exercise,
  ExerciseDomain,
  SideEmphasis,
} from "@/lib/exercise-schemas";

const DOMAIN_ORDER: { domain: ExerciseDomain; label: string }[] = [
  { domain: "breathing", label: "Napas" },
  { domain: "pelvic-floor", label: "Dasar Panggul" },
  { domain: "mobility", label: "Mobilitas" },
  { domain: "stability", label: "Stabilitas" },
  { domain: "core", label: "Core" },
  { domain: "balance", label: "Keseimbangan" },
  { domain: "strength", label: "Kekuatan" },
  { domain: "conditioning", label: "Kondisi" },
  { domain: "recovery", label: "Pemulihan" },
];

const SIDE_LABEL: Record<SideEmphasis, string> = {
  bilateral: "Kiri + kanan",
  left: "Sisi kiri",
  right: "Sisi kanan",
};

const DIFF_LABEL: Record<Exercise["difficulty"], string> = {
  beginner: "Pemula",
  intermediate: "Menengah",
  advanced: "Lanjutan",
};

export default function LibraryPage() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);

  useEffect(() => {
    syncSeedExercises().then(getAllExercises).then(setExercises);
  }, []);

  return (
    <div>
      <TopBar
        title="Exercise Library"
        subtitle="Semua gerakan bodyweight, dikelompokkan per domain."
      />

      <div className="flex flex-col gap-5 px-5 pb-8">
        {!exercises ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : (
          DOMAIN_ORDER.map(({ domain, label }) => {
            const items = exercises.filter((ex) => ex.domain === domain);
            if (items.length === 0) return null;
            return (
              <section key={domain}>
                <CardTitle>{label}</CardTitle>
                <div className="flex flex-col gap-2">
                  {items.map((ex) => (
                    <Card key={ex.id}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">
                          {ex.name}
                        </span>
                        <span className="tabular text-xs text-muted-foreground">
                          {ex.durationSeconds}s
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {DIFF_LABEL[ex.difficulty]}
                        </span>
                        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                          {SIDE_LABEL[ex.sideEmphasis]}
                        </span>
                      </div>
                      {ex.contraindications.length > 0 && (
                        <p className="mt-2 text-xs text-warning">
                          Hindari jika: {ex.contraindications.join(", ")}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
