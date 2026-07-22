"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Exercise } from "@/lib/exercise-schemas";
import type {
  AsymmetrySide,
  AsymmetryType,
  NewAsymmetryLogInput,
  NewSessionLogInput,
} from "@/lib/log-schemas";

/** Local YYYY-MM-DD key. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

interface Entry {
  value: number; // reps, or hold seconds for isometrics
  formRating: number;
  rpe: number;
  mirrorPass: boolean;
}

function initialEntry(ex: Exercise): Entry {
  const isHold = ex.holdSeconds != null;
  return {
    value: isHold ? ex.holdSeconds ?? 20 : ex.repTargetMin ?? 8,
    formRating: 4,
    rpe: 6,
    mirrorPass: false,
  };
}

const ASYM_SIDES: { key: AsymmetrySide; label: string }[] = [
  { key: "left", label: "Kiri" },
  { key: "right", label: "Kanan" },
  { key: "both", label: "Dua sisi" },
  { key: "central", label: "Tengah" },
];

const ASYM_TYPES: { key: AsymmetryType; label: string }[] = [
  { key: "sharp-pain", label: "Nyeri tajam" },
  { key: "tightness", label: "Kaku/tegang" },
  { key: "compensation", label: "Kompensasi" },
];

/**
 * Post-session logging (spec §6.2). Captures the per-exercise SessionLog the
 * promotion engine needs, plus the demoted 1-tap AsymmetryLog (spec §3) — a
 * safety log, NOT a gate. Surfaces the §6.5 accuracy caveat.
 */
export function SessionLogForm({
  exercises,
  onSave,
}: {
  exercises: Exercise[];
  onSave: (r: {
    logs: NewSessionLogInput[];
    asymmetry: NewAsymmetryLogInput | null;
  }) => void;
}) {
  const date = todayKey();
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(exercises.map((ex) => [ex.id, initialEntry(ex)]))
  );
  const [hadPain, setHadPain] = useState(false);
  const [side, setSide] = useState<AsymmetrySide>("right");
  const [type, setType] = useState<AsymmetryType>("sharp-pain");

  function patch(id: string, p: Partial<Entry>) {
    setEntries((e) => ({ ...e, [id]: { ...e[id], ...p } }));
  }

  function save() {
    const logs: NewSessionLogInput[] = exercises.map((ex) => {
      const e = entries[ex.id];
      const isHold = ex.holdSeconds != null;
      return {
        userId: "", // filled by the caller
        date,
        exerciseId: ex.id,
        repsDone: isHold ? null : e.value,
        holdSecondsDone: isHold ? e.value : null,
        formRating: e.formRating as 1 | 2 | 3 | 4 | 5,
        mirrorCheckPass: ex.mirrorCheckRequired ? e.mirrorPass : null,
        rpe: e.rpe as NewSessionLogInput["rpe"],
      };
    });
    const asymmetry: NewAsymmetryLogInput | null = hadPain
      ? { userId: "", date, side, type }
      : null;
    onSave({ logs, asymmetry });
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-8">
      <Card className="border-primary/40 bg-primary/5">
        <p className="text-xs text-foreground/70">
          App menentukan promosi dari data yang kamu input sendiri — termasuk
          form &amp; mirror check yang tidak bisa diverifikasi app. Kualitas
          keputusan = kejujuran input. Ini bukan pengganti penilaian PT.
        </p>
      </Card>

      {exercises.map((ex) => {
        const e = entries[ex.id];
        const isHold = ex.holdSeconds != null;
        return (
          <Card key={ex.id}>
            <CardTitle>{ex.name}</CardTitle>
            <div className="mt-1 flex flex-col gap-3">
              <label className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isHold ? "Detik tahan" : "Reps"}
                  {isHold && ex.holdSeconds != null && (
                    <span className="ml-1 text-xs">(target {ex.holdSeconds}s)</span>
                  )}
                  {!isHold && ex.repTargetMax != null && (
                    <span className="ml-1 text-xs">
                      (target {ex.repTargetMin ?? "?"}–{ex.repTargetMax})
                    </span>
                  )}
                </span>
                <input
                  type="number"
                  min={0}
                  value={e.value}
                  onChange={(ev) =>
                    patch(ex.id, { value: Math.max(0, Number(ev.target.value) || 0) })
                  }
                  className="w-20 rounded-[var(--radius-md)] border border-border bg-background px-2 py-1 text-right tabular"
                />
              </label>

              <div className="text-sm">
                <span className="text-muted-foreground">Form</span>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => patch(ex.id, { formRating: n })}
                      className={
                        "h-8 flex-1 rounded-[var(--radius-md)] text-sm font-semibold " +
                        (e.formRating === n
                          ? "bg-primary text-primary-foreground"
                          : "bg-background border border-border text-foreground/70")
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">RPE (1–10)</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={e.rpe}
                  onChange={(ev) =>
                    patch(ex.id, {
                      rpe: Math.min(10, Math.max(1, Number(ev.target.value) || 1)),
                    })
                  }
                  className="w-20 rounded-[var(--radius-md)] border border-border bg-background px-2 py-1 text-right tabular"
                />
              </label>

              {ex.mirrorCheckRequired && (
                <label className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mirror check lolos?</span>
                  <button
                    type="button"
                    onClick={() => patch(ex.id, { mirrorPass: !e.mirrorPass })}
                    className={
                      "rounded-full px-3 py-1 text-xs font-semibold " +
                      (e.mirrorPass
                        ? "bg-success/15 text-success"
                        : "bg-background border border-border text-foreground/70")
                    }
                  >
                    {e.mirrorPass ? "Ya" : "Belum"}
                  </button>
                </label>
              )}

              {ex.schrothCuePendingPT && (
                <p className="rounded-[var(--radius-md)] bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
                  Sisi/arah menunggu validasi Schroth PT — jangan tebak.
                </p>
              )}
            </div>
          </Card>
        );
      })}

      {/* Demoted safety log (spec §3) — non-gate 1-tap. */}
      <Card>
        <CardTitle>Nyeri tajam / satu sisi hari ini?</CardTitle>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setHadPain(false)}
            className={
              "flex-1 rounded-[var(--radius-md)] py-2 text-sm font-semibold " +
              (!hadPain
                ? "bg-primary text-primary-foreground"
                : "bg-background border border-border text-foreground/70")
            }
          >
            Tidak
          </button>
          <button
            type="button"
            onClick={() => setHadPain(true)}
            className={
              "flex-1 rounded-[var(--radius-md)] py-2 text-sm font-semibold " +
              (hadPain
                ? "bg-warning text-background"
                : "bg-background border border-border text-foreground/70")
            }
          >
            Ya
          </button>
        </div>
        {hadPain && (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <span className="text-xs text-muted-foreground">Sisi</span>
              <div className="mt-1 flex gap-1">
                {ASYM_SIDES.map((s) => (
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
            <div>
              <span className="text-xs text-muted-foreground">Jenis</span>
              <div className="mt-1 flex gap-1">
                {ASYM_TYPES.map((t) => (
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
            <p className="text-[11px] text-muted-foreground">
              Ini catatan keamanan, bukan penghenti sesi. Pola berulang →
              disarankan cek PT.
            </p>
          </div>
        )}
      </Card>

      <Button size="lg" onClick={save}>
        <Check size={18} /> Simpan catatan
      </Button>
    </div>
  );
}
