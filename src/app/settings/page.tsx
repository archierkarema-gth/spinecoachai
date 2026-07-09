"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { putUser, resetUserData } from "@/lib/db";
import { isCloudConfigured } from "@/lib/supabase";
import { syncAll } from "@/lib/sync";

export default function SettingsPage() {
  const router = useRouter();
  const { user, hydrated, hydrate, setUser } = useAppStore();
  const [name, setName] = useState("");
  const [age, setAge] = useState(32);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    setCloudReady(isCloudConfigured());
  }, []);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAge(user.age);
    }
  }, [user]);

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
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await syncAll(user.id);
      setSyncMsg(
        result.ran
          ? `Selesai — ${result.pushed} terkirim, ${result.pulled} diunduh.`
          : "Cloud belum dikonfigurasi."
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
          <CardTitle>Cloud sync</CardTitle>
          {cloudReady ? (
            <>
              <p className="text-sm text-muted-foreground">
                Sinkronkan asesmen, check-in, sesi, dan catatan nyeri ke
                Supabase. Foto tetap di perangkat.
              </p>
              <Button onClick={onSync} disabled={syncing || !user}>
                {syncing ? "Menyinkronkan…" : "Sinkronkan sekarang"}
              </Button>
              {syncMsg && (
                <p className="text-xs text-muted-foreground">{syncMsg}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Belum dikonfigurasi. Isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di{" "}
              <code>.env.local</code>, lalu jalankan migrasi di{" "}
              <code>supabase/migrations</code>.
            </p>
          )}
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
          SpineCoach AI menyimpan data hanya di perangkat ini (IndexedDB).
          Belum ada sinkronisasi cloud.
        </p>
      </div>
    </div>
  );
}
