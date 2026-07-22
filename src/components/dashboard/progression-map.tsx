"use client";

import { Lock } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import type { FamilyProgress } from "@/lib/progression-view";
import type { ProjectionStatus } from "@/lib/progression";
import { projectionDiagnosis } from "@/lib/progression";

const LEVEL_NAMES = ["", "Beginner", "Intermediate", "Advanced", "Master"];

const STATUS_STYLE: Record<ProjectionStatus, { label: string; cls: string }> = {
  achieved: { label: "Tercapai", cls: "bg-success/15 text-success" },
  "on-track": { label: "On track", cls: "bg-primary/10 text-primary" },
  "slightly-behind": { label: "Agak tertinggal", cls: "bg-warning/15 text-warning" },
  behind: { label: "Tertinggal", cls: "bg-destructive/10 text-destructive" },
};

function LevelDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1" aria-label={`Level ${level} dari 4`}>
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={
            "h-1.5 w-5 rounded-full " +
            (n <= level ? "bg-primary" : "bg-border")
          }
        />
      ))}
    </div>
  );
}

/** Progression map (spec §7): current level, next unlock, 6-month projection. */
export function ProgressionMap({ rows }: { rows: FamilyProgress[] }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <CardTitle>Peta progresi (family fondasi)</CardTitle>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const status = STATUS_STYLE[r.projection.status];
          const diag = projectionDiagnosis(r.projection.status);
          return (
            <Card key={r.family}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-card-foreground">
                    {r.label}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    L{r.currentLevel} {LEVEL_NAMES[r.currentLevel]} · {r.activeName}
                  </p>
                </div>
                <span
                  className={
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                    status.cls
                  }
                >
                  {status.label}
                </span>
              </div>
              <div className="mt-2">
                <LevelDots level={r.currentLevel} />
              </div>
              {r.nextName && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {r.locked && <Lock size={12} className="text-warning" />}
                  Berikutnya: {r.nextName}
                  {r.locked === "pt-clearance" && " (butuh PT-clearance)"}
                  {r.locked === "contraindicated" && " (tidak direkomendasikan)"}
                </p>
              )}
              {diag && (
                <p className="mt-1.5 rounded-[var(--radius-md)] bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
                  {diag}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
