"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScalePicker } from "@/components/ui/scale-picker";
import { useAppStore } from "@/lib/store";
import { getPainLogsForUser, putPainLog } from "@/lib/db";
import type { PainLog } from "@/lib/log-schemas";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PainPage() {
  const { user, hydrated, hydrate } = useAppStore();
  const [painLevel, setPainLevel] = useState(3);
  const [areas, setAreas] = useState("");
  const [note, setNote] = useState("");
  const [logs, setLogs] = useState<PainLog[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (user) getPainLogsForUser(user.id).then(setLogs);
  }, [user]);

  async function onSave() {
    if (!user) return;
    setSaving(true);
    const log: PainLog = {
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: Date.now(),
      painLevel,
      areas: areas || undefined,
      note: note || undefined,
    };
    await putPainLog(log);
    setLogs(await getPainLogsForUser(user.id));
    setAreas("");
    setNote("");
    setSaving(false);
  }

  return (
    <div>
      <TopBar
        title="Pain Tracker"
        subtitle="Catat nyeri harian. Data ini bantu SpineCoach menyesuaikan latihan."
      />

      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card className="flex flex-col gap-3">
          <div>
            <Label>Level nyeri (0–10)</Label>
            <ScalePicker
              value={painLevel}
              onChange={setPainLevel}
              min={0}
              max={10}
              lowLabel="Tidak nyeri"
              highLabel="Sangat nyeri"
            />
          </div>
          <div>
            <Label htmlFor="areas">Area</Label>
            <Input
              id="areas"
              placeholder="mis. pinggang kiri"
              value={areas}
              onChange={(e) => setAreas(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="note">Catatan</Label>
            <Textarea
              id="note"
              placeholder="Kapan mulai, dipicu apa?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button onClick={onSave} disabled={saving || !user}>
            {saving ? "Menyimpan…" : "Simpan catatan nyeri"}
          </Button>
        </Card>

        <section>
          <CardTitle>Riwayat</CardTitle>
          {logs.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">Belum ada catatan.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {logs.map((log) => (
                <Card key={log.id}>
                  <div className="flex items-center justify-between">
                    <span className="tabular text-sm font-semibold text-card-foreground">
                      Nyeri {log.painLevel}/10
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                  {log.areas && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.areas}
                    </p>
                  )}
                  {log.note && (
                    <p className="mt-1 text-sm text-card-foreground">{log.note}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
