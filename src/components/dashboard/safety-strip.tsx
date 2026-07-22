"use client";

import { ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { SafetyStrip as SafetyStripData } from "@/lib/progression-view";

/** Safety strip (spec §7): PT-clearance state, unreviewed asymmetry, alert. */
export function SafetyStrip({ data }: { data: SafetyStripData }) {
  return (
    <Card className="gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-card-foreground">
          {data.ptCleared ? (
            <ShieldCheck size={16} className="text-success" />
          ) : (
            <ShieldAlert size={16} className="text-warning" />
          )}
          PT clearance
        </span>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
            (data.ptCleared
              ? "bg-success/15 text-success"
              : "bg-warning/15 text-warning")
          }
        >
          {data.ptCleared ? "Aktif" : "Belum"}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-card-foreground">Catatan asimetri belum ditinjau</span>
        <span className="tabular text-muted-foreground">{data.unreviewed}</span>
      </div>
      {data.alert.raised && data.alert.message && (
        <p className="mt-1 flex items-start gap-1.5 rounded-[var(--radius-md)] bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {data.alert.message}
        </p>
      )}
    </Card>
  );
}
