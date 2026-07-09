"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScalePicker } from "@/components/ui/scale-picker";
import { newCheckInInputSchema } from "@/lib/exercise-schemas";
import { putCheckIn } from "@/lib/db";
import { useAppStore } from "@/lib/store";

export default function CheckinPage() {
  const router = useRouter();
  const { user, hydrated, hydrate, latestAssessment, setLatestCheckIn } =
    useAppStore();

  const [painLevel, setPainLevel] = useState(2);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [energyLevel, setEnergyLevel] = useState(3);
  const [recovery, setRecovery] = useState(3);
  const [availableMinutes, setAvailableMinutes] = useState(
    latestAssessment?.availableMinutesPerDay ?? 20
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  async function onSubmit() {
    if (!user) return;
    const parsed = newCheckInInputSchema.safeParse({
      userId: user.id,
      painLevel,
      sleepQuality,
      energyLevel,
      recovery,
      availableMinutes,
    });
    if (!parsed.success) {
      setError("Periksa lagi isian kamu.");
      return;
    }
    setSaving(true);
    const checkIn = {
      ...parsed.data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    await putCheckIn(checkIn);
    setLatestCheckIn(checkIn);
    router.push("/workout");
  }

  if (hydrated && !latestAssessment) {
    return (
      <div className="px-5 pt-6">
        <Card>
          <p className="text-sm text-muted-foreground">
            Isi asesmen awal dulu sebelum check-in harian.
          </p>
          <Link
            href="/assessment"
            className="mt-3 inline-block text-sm font-semibold text-primary"
          >
            Ke asesmen awal →
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <TopBar
        title="Check-in harian"
        subtitle="Kondisi kamu hari ini menentukan sesi yang disusun."
      />

      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card>
          <Label>Nyeri hari ini (0–10)</Label>
          <ScalePicker
            value={painLevel}
            onChange={setPainLevel}
            min={0}
            max={10}
            lowLabel="Tidak nyeri"
            highLabel="Sangat nyeri"
          />
        </Card>

        <Card>
          <Label>Kualitas tidur</Label>
          <ScalePicker
            value={sleepQuality}
            onChange={setSleepQuality}
            lowLabel="Buruk"
            highLabel="Nyenyak"
          />
        </Card>

        <Card>
          <Label>Energi</Label>
          <ScalePicker
            value={energyLevel}
            onChange={setEnergyLevel}
            lowLabel="Lemas"
            highLabel="Bertenaga"
          />
        </Card>

        <Card>
          <Label>Pemulihan otot</Label>
          <ScalePicker
            value={recovery}
            onChange={setRecovery}
            lowLabel="Masih pegal"
            highLabel="Segar"
          />
        </Card>

        <Card>
          <Label htmlFor="minutes">Waktu tersedia (menit)</Label>
          <Input
            id="minutes"
            type="number"
            min={5}
            max={180}
            value={availableMinutes}
            onChange={(e) => setAvailableMinutes(Number(e.target.value))}
          />
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button size="lg" onClick={onSubmit} disabled={saving || !user}>
          {saving ? "Menyusun sesi…" : "Susun sesi hari ini"}
        </Button>
      </div>
    </div>
  );
}
