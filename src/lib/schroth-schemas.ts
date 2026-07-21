import { z } from "zod";

/**
 * Schroth breathing module — a self-directed daily corrective-breathing
 * checklist, separate from the AI Decision Engine's daily session (which
 * already auto-picks one "breathing" domain move per day).
 *
 * Guardrail (docs/04_Clinical_Guardrails.md, docs/11_Roadmap_M9-M14.md): this
 * module never computes or targets a specific curve. Every cue below is
 * generic and self-directed — the owner applies it using their own body
 * awareness (and their physician/physiotherapist's guidance), the app never
 * decides "breathe toward side X because your curve is Y°".
 */

export const schrothExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  durationSeconds: z.number().int().positive(),
  breaths: z.number().int().positive(),
  description: z.string(),
  position: z.string(),
  purpose: z.string(),
  cues: z.array(z.string()),
  contraindications: z.array(z.string()),
});
export type SchrothExercise = z.infer<typeof schrothExerciseSchema>;

/** One checklist entry per local calendar day — "Schroth hari ini: N/6". */
export const schrothLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid"),
  completedIds: z.array(z.string()),
  updatedAt: z.number(),
});
export type SchrothLog = z.infer<typeof schrothLogSchema>;

/** Local (device-timezone) YYYY-MM-DD key — used so "today" resets at midnight local time. */
export function todayKey(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
