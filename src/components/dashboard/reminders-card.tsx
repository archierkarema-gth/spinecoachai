"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { DAILY_REMINDERS, nextDaily } from "@/lib/reminders";

/** Dashboard reminder schedule (spec §8) — in-app list + the next one up. */
export function RemindersCard() {
  // Captured once on mount (lazy init) so render stays pure and SSR-safe.
  const [now] = useState(() => new Date());
  const next = nextDaily(now);

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Bell size={16} className="text-primary" />
        <CardTitle className="mb-0">Pengingat harian</CardTitle>
      </div>
      {next && (
        <p className="mt-2 text-sm text-card-foreground">
          Berikutnya <span className="tabular font-semibold">{next.reminder.time}</span>
          {next.wrapped ? " (besok)" : ""} — {next.reminder.label}
        </p>
      )}
      <div className="mt-2 flex flex-col gap-1">
        {DAILY_REMINDERS.map((r) => (
          <div
            key={r.id}
            className="flex items-start gap-2 text-xs text-muted-foreground"
          >
            <span className="tabular shrink-0 font-semibold text-foreground/70">
              {r.time}
            </span>
            <span>{r.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
