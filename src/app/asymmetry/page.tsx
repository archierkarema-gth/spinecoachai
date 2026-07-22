"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/lib/store";
import { putAsymmetryLog, setAsymmetryReviewed } from "@/lib/db";
import { todayKey } from "@/lib/schroth-schemas";
import type { AsymmetrySide, AsymmetryType } from "@/lib/log-schemas";

const SIDES: { key: AsymmetrySide; label: string }[] = [
  { key: "left", label: "Kiri" },
  { key: "right", label: "Kanan" },
  { key: "both", label: "Dua sisi" },
  { key: "central", label: "Tengah" },
];
const TYPES: { key: AsymmetryType; label: string }[] = [
  { key: "sharp-pain", label: "Nyeri tajam" },
  { key: "tightness", label: "Kaku/tegang" },
  { key: "compensation", label: "Kompensasi" },
];
const SIDE_LABEL: Record<AsymmetrySide, string> = {
  left: "Kiri",
  right: "Kanan",
  both: "Dua sisi",
  central: "Tengah",
};
const TYPE_LABEL: Record<AsymmetryType, string> = {
  "sharp-pain": "Nyeri tajam",
  tightness: "Kaku/tegang",
  compensation: "Kompensasi",
};

function fmt(ts: number): string {
  return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function AsymmetryPage() {
  const { user, hydrated, hydrate, asymmetryLogs, refreshM16Logs } = useAppStore();
  const [side, setSide] = useState<AsymmetrySide>("right");
  const [type, setType] = useState<AsymmetryType>("sharp-pain");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  async function save() {
    if (!user) return;
    setSaving(true);
    await putAsymmetryLog({
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: Date.now(),
      date: todayKey(),
      side,
      type,
      note: note || undefined,
      reviewed: false,
    });
    await refreshM16Logs();
    setNote("");
    setSaving(false);
  }

  async function toggleReviewed(id: string, current: boolean) {
    await setAsymmetryReviewed(id, !current);
    await refreshM16Logs();
  }

  return (
    <div>
      <TopBar
        title="Asymmetry Logger"
        subtitle="Nyeri / tegang / kompensasi satu sisi."
      />
      <div className="flex flex-col gap-4 px-5 pb-8">
        <Card>
          <CardTitle>Catat</CardTitle>
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">Sisi</span>
            <div className="mt-1 flex gap-1">
              {SIDES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSide(s.key)}
                  className={
                    "flex-1 rounded-[var(--radius-md)] py-1.5 text-xs font-semibold " +
                    (side === s.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border border-border text-foreground/70")
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xs text-muted-foreground">Jenis</span>
            <div className="mt-1 flex gap-1">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  className={
                    "flex-1 rounded-[var(--radius-md)] py-1.5 text-xs font-semibold " +
                    (type === t.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border border-border text-foreground/70")
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <Textarea
              placeholder="Catatan (opsional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button className="mt-3 w-full" onClick={save} disabled={saving || !user}>
            {saving ? "Menyimpan…" : "Simpan catatan"}
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Catatan keamanan, bukan penghenti sesi. Pola berulang → disarankan
            cek PT.
          </p>
        </Card>

        <section>
          <CardTitle>Riwayat</CardTitle>
          {asymmetryLogs.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">Belum ada catatan.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {asymmetryLogs.slice(0, 30).map((l) => (
                <Card key={l.id} className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">
                      {SIDE_LABEL[l.side]} · {TYPE_LABEL[l.type]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(l.createdAt)}
                      {l.note ? ` · ${l.note}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleReviewed(l.id, l.reviewed)}
                    className={
                      "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold " +
                      (l.reviewed
                        ? "bg-success/15 text-success"
                        : "bg-warning/15 text-warning")
                    }
                  >
                    {l.reviewed ? (
                      <>
                        <Check size={11} className="inline" /> Ditinjau
                      </>
                    ) : (
                      "Tandai ditinjau"
                    )}
                  </button>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
