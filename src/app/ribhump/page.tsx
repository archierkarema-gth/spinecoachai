"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { getRibHumpLogsForUser, putRibHumpLog } from "@/lib/db";
import { todayKey } from "@/lib/schroth-schemas";
import type { RibHumpLog } from "@/lib/log-schemas";

function fmt(ts: number): string {
  return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function RibHumpPage() {
  const { user, hydrated, hydrate } = useAppStore();
  const [logs, setLogs] = useState<RibHumpLog[]>([]);
  const [deg, setDeg] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (user) getRibHumpLogsForUser(user.id).then(setLogs);
  }, [user]);

  async function save() {
    if (!user) return;
    const d = Number(deg);
    if (!Number.isFinite(d) || d < 0 || d > 60) return;
    setSaving(true);
    await putRibHumpLog({
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: Date.now(),
      date: todayKey(),
      forwardBendDegrees: d,
      note: note || undefined,
    });
    setLogs(await getRibHumpLogsForUser(user.id));
    setDeg("");
    setNote("");
    setSaving(false);
  }

  // Oldest→newest for the trend line.
  const trend = [...logs].reverse().map((l) => l.forwardBendDegrees);

  return (
    <div>
      <TopBar
        title="Rib Hump Tracker"
        subtitle="Sudut forward-bend (Adam's test)."
      />
      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card className="border-warning/40 bg-warning/5">
          <p className="text-xs text-foreground/70">
            Ini catatan pribadi, bukan pengukuran klinis. Scoliometer mandiri
            berisik ±beberapa derajat — app TIDAK menyimpulkan &quot;memburuk&quot;.
            Lihat tren, dan cek ke PT/dokter untuk penilaian sebenarnya.
          </p>
        </Card>

        <Card>
          <CardTitle>Tren</CardTitle>
          {trend.length > 0 ? (
            <>
              <Sparkline values={trend} ariaLabel="Tren sudut rib hump" />
              <p className="mt-1 text-xs text-muted-foreground">
                Terakhir: {logs[0].forwardBendDegrees}° · {fmt(logs[0].createdAt)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada data.</p>
          )}
        </Card>

        <Card>
          <CardTitle>Catat pengukuran</CardTitle>
          <div className="mt-2 flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="deg">Sudut (derajat)</Label>
              <Input
                id="deg"
                type="number"
                min={0}
                max={60}
                inputMode="numeric"
                placeholder="mis. 8"
                value={deg}
                onChange={(e) => setDeg(e.target.value)}
              />
            </div>
            <Button onClick={save} disabled={saving || !user || !deg}>
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
          <div className="mt-2">
            <Label htmlFor="rh-note">Catatan (opsional)</Label>
            <Textarea
              id="rh-note"
              placeholder="mis. diukur pagi, alat X"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </Card>

        {logs.length > 0 && (
          <section>
            <CardTitle>Riwayat</CardTitle>
            <div className="flex flex-col gap-2">
              {logs.slice(0, 20).map((l) => (
                <Card key={l.id}>
                  <div className="flex items-center justify-between">
                    <span className="tabular text-sm font-semibold text-card-foreground">
                      {l.forwardBendDegrees}°
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fmt(l.createdAt)}
                    </span>
                  </div>
                  {l.note && (
                    <p className="mt-1 text-xs text-muted-foreground">{l.note}</p>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
