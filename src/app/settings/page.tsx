"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import type { TrainingPreset } from "@/lib/schemas";
import { putUser, resetUserData } from "@/lib/db";
import { getSyncCode, setSyncCode, generateSyncCode } from "@/lib/supabase";
import { syncAll } from "@/lib/sync";

const PRESETS: { value: TrainingPreset; label: string; desc: string }[] = [
  { value: "balanced", label: "Seimbang", desc: "Porsi merata semua domain." },
  {
    value: "muscle-priority",
    label: "Fokus otot (70/30)",
    desc: "Utamakan pembentukan otot, tetap sisipkan korektif skoliosis.",
  },
];

// Only equipment referenced by the exercise seed is offered here.
const EQUIPMENT: { value: string; label: string; desc: string }[] = [
  {
    value: "pull-up bar",
    label: "Pull-up bar",
    desc: "Buka program progresi pull-up.",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, hydrated, hydrate, setUser } = useAppStore();
  const [name, setName] = useState("");
  const [age, setAge] = useState(32);
  const [saved, setSaved] = useState(false);
  const [preset, setPreset] = useState<TrainingPreset>("balanced");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [trainingSaved, setTrainingSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [syncCode, setSyncCodeInput] = useState("");
  const [codeSaved, setCodeSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    setSyncCodeInput(getSyncCode() ?? "");
  }, []);

  function onSaveCode() {
    setSyncCode(syncCode);
    setCodeSaved(true);
    setTimeout(() => setCodeSaved(false), 2000);
  }

  function onGenerateCode() {
    const code = generateSyncCode();
    setSyncCodeInput(code);
    setSyncCode(code);
  }

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAge(user.age);
      setPreset(user.trainingPreset ?? "balanced");
      setEquipment(user.ownedEquipment ?? []);
    }
  }, [user]);

  function toggleEquipment(value: string) {
    setEquipment((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  async function onSaveTraining() {
    if (!user) return;
    const updated = { ...user, trainingPreset: preset, ownedEquipment: equipment };
    await putUser(updated);
    setUser(updated);
    setTrainingSaved(true);
    setTimeout(() => setTrainingSaved(false), 2000);
  }

  async function onSaveProfile() {
    if (!user) return;
    const updated = { ...user, name: name.trim() || user.name, age };
    await putUser(updated);
    setUser(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function onSync() {
    if (!user) return;
    setSyncCode(syncCode);
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await syncAll(user.id);
      setSyncMsg(
        result.ran
          ? `Selesai — ${result.pushed} terkirim, ${result.pulled} diunduh.`
          : "Isi kode sync dulu."
      );
      await hydrate();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync gagal.");
    } finally {
      setSyncing(false);
    }
  }

  async function onReset() {
    await resetUserData();
    // Full reload so the store re-seeds a fresh user on next hydrate.
    router.push("/");
    router.refresh();
    if (typeof window !== "undefined") window.location.href = "/";
  }

  return (
    <div>
      <TopBar title="Settings" subtitle="Profil dan data aplikasi." />

      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card className="flex flex-col gap-3">
          <CardTitle>Profil</CardTitle>
          <div>
            <Label htmlFor="name">Nama</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="age">Umur</Label>
            <Input
              id="age"
              type="number"
              min={13}
              max={100}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
            />
          </div>
          <Button onClick={onSaveProfile} disabled={!user}>
            {saved ? "Tersimpan" : "Simpan profil"}
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <CardTitle>Latihan</CardTitle>
          <p className="text-sm text-muted-foreground">
            Atur fokus program dan alat yang kamu punya. Sesi harian menyesuaikan
            pilihan ini.
          </p>

          <div>
            <Label>Preset fokus</Label>
            <div className="mt-1 flex flex-col gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPreset(p.value)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    preset === p.value
                      ? "border-primary bg-primary/10"
                      : "border-border"
                  }`}
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {p.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {p.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Alat yang dimiliki</Label>
            <div className="mt-1 flex flex-col gap-2">
              {EQUIPMENT.map((eq) => {
                const checked = equipment.includes(eq.value);
                return (
                  <button
                    key={eq.value}
                    type="button"
                    onClick={() => toggleEquipment(eq.value)}
                    className={`flex items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                      checked ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">
                        {eq.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {eq.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button onClick={onSaveTraining} disabled={!user}>
            {trainingSaved ? "Tersimpan" : "Simpan latihan"}
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <CardTitle>Sync antar perangkat</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pakai <strong>kode sync</strong> yang sama di semua perangkat untuk
            menyambungkan data. Asesmen, check-in, sesi, dan catatan nyeri ikut
            tersinkron. Foto tetap di perangkat.
          </p>
          <div>
            <Label htmlFor="syncCode">Kode sync</Label>
            <Input
              id="syncCode"
              value={syncCode}
              placeholder="Tempel kode dari perangkat lain"
              onChange={(e) => setSyncCodeInput(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onGenerateCode}>
              Buat kode baru
            </Button>
            <Button variant="outline" className="flex-1" onClick={onSaveCode}>
              {codeSaved ? "Tersimpan" : "Simpan kode"}
            </Button>
          </div>
          <Button onClick={onSync} disabled={syncing || !user || !syncCode.trim()}>
            {syncing ? "Menyinkronkan…" : "Sinkronkan sekarang"}
          </Button>
          {syncMsg && <p className="text-xs text-muted-foreground">{syncMsg}</p>}
          <p className="text-[11px] text-muted-foreground">
            Simpan kode ini baik-baik: siapa pun yang tahu kode bisa mengakses
            datamu. Di perangkat kedua, tempel kode yang sama lalu Sinkronkan.
          </p>
        </Card>

        <Card className="flex flex-col gap-3 border-destructive/40">
          <CardTitle>Reset data</CardTitle>
          <p className="text-sm text-muted-foreground">
            Menghapus semua asesmen, check-in, sesi, catatan nyeri, dan foto
            dari perangkat ini. Tidak bisa dibatalkan.
          </p>
          {!confirmReset ? (
            <Button
              variant="outline"
              className="border-destructive text-destructive"
              onClick={() => setConfirmReset(true)}
            >
              Reset semua data
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmReset(false)}
              >
                Batal
              </Button>
              <Button
                className="flex-1 bg-destructive text-white"
                onClick={onReset}
              >
                Ya, hapus
              </Button>
            </div>
          )}
        </Card>

        <p className="px-1 text-xs text-muted-foreground">
          Data tersimpan di perangkat ini (IndexedDB). Dengan kode sync,
          data juga tersalin ke cloud dan bisa diakses dari perangkat lain
          yang memakai kode sama.
        </p>
      </div>
    </div>
  );
}
