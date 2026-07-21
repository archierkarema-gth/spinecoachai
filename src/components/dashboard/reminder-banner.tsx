"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { shouldShowReminder } from "@/lib/pwa";

function todayKeyLocal(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ReminderBanner() {
  const { latestAssessment, latestCheckIn } = useAppStore();
  const [dismissed, setDismissed] = useState(true); // default hidden until client mount

  useEffect(() => {
    const key = `reminder-dismissed-${todayKeyLocal(new Date())}`;
    setDismissed(window.localStorage.getItem(key) === "1");
  }, []);

  const visible =
    !dismissed &&
    shouldShowReminder({
      now: new Date(),
      hasAssessment: !!latestAssessment,
      latestCheckInAt: latestCheckIn?.createdAt ?? null,
    });

  if (!visible) return null;

  function dismiss() {
    const key = `reminder-dismissed-${todayKeyLocal(new Date())}`;
    window.localStorage.setItem(key, "1");
    setDismissed(true);
  }

  return (
    <Card className="flex flex-row items-center justify-between gap-3 border-transparent bg-primary/10">
      <p className="text-sm text-foreground">
        Belum check-in hari ini. Yuk isi biar sesi hari ini pas.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/checkin">
          <Button variant="default" className="px-3 py-1.5 text-xs">
            Check-in
          </Button>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup pengingat"
          className="text-foreground/60"
        >
          ×
        </button>
      </div>
    </Card>
  );
}
