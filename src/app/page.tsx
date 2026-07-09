"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { putUser } from "@/lib/db";

// Personal-use MVP (docs/01_Project_Charter.md): single local user, seeded
// on first load so the assessment can attach to a userId immediately.
async function ensureUser() {
  const { user, setUser } = useAppStore.getState();
  if (user) return;
  const seeded = {
    id: crypto.randomUUID(),
    name: "Archie",
    age: 32,
    createdAt: Date.now(),
  };
  await putUser(seeded);
  setUser(seeded);
}

export default function DashboardPage() {
  const { hydrated, user, latestAssessment, hydrate } = useAppStore();

  useEffect(() => {
    hydrate().then(ensureUser);
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="px-5 pt-10 text-sm text-muted-foreground">
        Memuat…
      </div>
    );
  }

  return (
    <div>
      <TopBar
        title={`Halo, ${user?.name ?? "Archie"}`}
        subtitle="Dashboard — ringkasan latihan & postur kamu."
      />

      <div className="flex flex-col gap-4 px-5">
        {!latestAssessment ? (
          <Card className="bg-primary text-primary-foreground border-transparent">
            <CardTitle className="text-primary-foreground/70">
              Mulai di sini
            </CardTitle>
            <p className="text-sm mb-3">
              Isi asesmen awal dulu supaya SpineCoach bisa mulai menyusun
              program latihan yang aman buat kamu.
            </p>
            <Link href="/assessment">
              <Button variant="primary" className="w-full">
                Mulai asesmen awal
              </Button>
            </Link>
          </Card>
        ) : (
          <Card>
            <CardTitle>Asesmen terakhir</CardTitle>
            <p className="text-sm text-foreground">
              Nyeri {latestAssessment.painLevel}/10 · Level aktivitas{" "}
              {latestAssessment.activityLevel} ·{" "}
              {latestAssessment.availableMinutesPerDay} menit/hari
            </p>
            <Link
              href="/assessment"
              className="mt-3 inline-block text-xs font-semibold text-primary"
            >
              Isi ulang asesmen →
            </Link>
          </Card>
        )}

        <Card>
          <CardTitle>Sesi hari ini</CardTitle>
          <p className="text-sm text-muted-foreground">
            AI Decision Engine belum tersedia di milestone ini — halaman
            Workout masih placeholder.
          </p>
        </Card>

        <Card>
          <CardTitle>Progres</CardTitle>
          <p className="text-sm text-muted-foreground">
            Belum ada data. Progress tracking akan aktif setelah modul
            Workout Log &amp; Pain Tracker dibangun.
          </p>
        </Card>
      </div>
    </div>
  );
}
