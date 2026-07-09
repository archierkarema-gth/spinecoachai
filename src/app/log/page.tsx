"use client";

import { useEffect } from "react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LogPage() {
  const { hydrated, hydrate, workoutLogs } = useAppStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  return (
    <div>
      <TopBar title="Workout Log" subtitle="Semua sesi yang sudah kamu selesaikan." />

      <div className="flex flex-col gap-3 px-5 pb-8">
        {workoutLogs.length === 0 ? (
          <Card>
            <p className="text-sm text-muted-foreground">
              Belum ada sesi tersimpan.
            </p>
          </Card>
        ) : (
          workoutLogs.map((log) => (
            <Card key={log.id}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {log.movementFocus}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(log.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground capitalize">
                {log.intensity} · {log.estimatedMinutes} mnt
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {log.exercises.map((ex, i) => (
                  <div
                    key={`${ex.exerciseId}-${i}`}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-foreground">{ex.name}</span>
                    <span className="text-success">
                      {ex.completed ? "selesai" : "dilewati"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
