"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScalePicker } from "@/components/ui/scale-picker";
import { newReassessmentLogInputSchema } from "@/lib/log-schemas";
import { putReassessmentLog } from "@/lib/db";
import { useAppStore } from "@/lib/store";

export default function ReassessPage() {
  const router = useRouter();
  const { user, hydrated, hydrate, latestAssessment, refreshReassessment } =
    useAppStore();

  const [flexibility, setFlexibility] = useState(3);
  const [balance, setBalance] = useState(3);
  const [breathingQuality, setBreathingQuality] = useState(3);
  const [painAreas, setPainAreas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  async function onSubmit() {
    if (!user) return;
    const parsed = newReassessmentLogInputSchema.safeParse({
      userId: user.id,
      flexibility,
      balance,
      breathingQuality,
      painAreas: painAreas || undefined,
    });
    if (!parsed.success) {
      setError("Periksa lagi isian kamu.");
      return;
    }
    setSaving(true);
    try {
      await putReassessmentLog({
        ...parsed.data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      });
      await refreshReassessment();
      router.push("/workout");
    } catch {
      setSaving(false);
      setError("Gagal menyimpan, coba lagi.");
    }
  }

  if (hydrated && !latestAssessment) {
    return (
      <div className="px-5 pt-6">
        <Card>
          <p className="text-sm text-muted-foreground">
            Isi asesmen awal dulu sebelum reassessment mingguan.
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
        title="Reassessment mingguan"
        subtitle="Kondisi kamu minggu ini — dipakai buat sesuaikan fokus latihan."
      />

      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card>
          <Label>Fleksibilitas minggu ini</Label>
          <ScalePicker
            value={flexibility}
            onChange={setFlexibility}
            lowLabel="Kaku"
            highLabel="Lentur"
          />
        </Card>

        <Card>
          <Label>Keseimbangan minggu ini</Label>
          <ScalePicker
            value={balance}
            onChange={setBalance}
            lowLabel="Goyah"
            highLabel="Stabil"
          />
        </Card>

        <Card>
          <Label>Kualitas napas minggu ini</Label>
          <ScalePicker
            value={breathingQuality}
            onChange={setBreathingQuality}
            lowLabel="Sesak/dangkal"
            highLabel="Lega/dalam"
          />
        </Card>

        <Card>
          <Label htmlFor="pain-areas">Area nyeri (opsional)</Label>
          <Textarea
            id="pain-areas"
            value={painAreas}
            onChange={(e) => setPainAreas(e.target.value)}
            placeholder="Misal: punggung bawah, bahu kanan"
          />
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button size="lg" onClick={onSubmit} disabled={saving || !user}>
          {saving ? "Menyimpan…" : "Simpan reassessment"}
        </Button>
      </div>
    </div>
  );
}
