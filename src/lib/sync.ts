import { getSupabase, getSyncCode } from "@/lib/supabase";
import {
  getAssessmentsForUser,
  getCheckInsForUser,
  getWorkoutLogsForUser,
  getPainLogsForUser,
  putAssessment,
  putCheckIn,
  putWorkoutLog,
  putPainLog,
} from "@/lib/db";
import type { Assessment } from "@/lib/schemas";
import type { CheckIn } from "@/lib/exercise-schemas";
import type { WorkoutLog, PainLog } from "@/lib/log-schemas";

/**
 * Cross-device sync (docs/09 future). All synced entities live in a single
 * `records` table keyed by the user's sync code (`sync_id`). Records are
 * append-mostly with client-generated UUIDs, so syncing is an id-keyed upsert
 * in each direction; the local copy always wins on a shared id.
 *
 * Local record ids stay stable across devices, but the embedded `userId`
 * differs per device (each device seeds its own local user). On pull we
 * rewrite `userId` to the local user's id so the by-userId indexes resolve.
 *
 * Photos are intentionally not synced (blobs stay on-device).
 */

export type SyncKind = "assessment" | "check_in" | "workout_log" | "pain_log";

export interface SyncResult {
  ran: boolean;
  pushed: number;
  pulled: number;
}

interface RecordRow {
  id: string;
  sync_id: string;
  kind: SyncKind;
  created_at: string;
  payload: Record<string, unknown>;
}

/** Records in `remote` whose id is missing from `local` — the pull set. */
export function idsToPull<T extends { id: string }>(
  local: { id: string }[],
  remote: T[]
): T[] {
  const localIds = new Set(local.map((l) => l.id));
  return remote.filter((r) => !localIds.has(r.id));
}

/**
 * Two-way sync for one device. Pushes every local record the cloud is missing,
 * then pulls every cloud record this device is missing, rewriting each pulled
 * record's userId to the local user's id. No-op when no sync code is set.
 */
export async function syncAll(localUserId: string): Promise<SyncResult> {
  const syncId = getSyncCode();
  if (!syncId) return { ran: false, pushed: 0, pulled: 0 };

  const supabase = getSupabase();

  const [assessments, checkIns, workoutLogs, painLogs] = await Promise.all([
    getAssessmentsForUser(localUserId),
    getCheckInsForUser(localUserId),
    getWorkoutLogsForUser(localUserId),
    getPainLogsForUser(localUserId),
  ]);

  let pushed = 0;
  let pulled = 0;

  // Push local records (upsert on id is idempotent).
  const pushGroups: [SyncKind, { id: string; createdAt: number }[]][] = [
    ["assessment", assessments],
    ["check_in", checkIns],
    ["workout_log", workoutLogs],
    ["pain_log", painLogs],
  ];
  for (const [kind, records] of pushGroups) {
    if (records.length === 0) continue;
    const rows = records.map((r) => ({
      id: r.id,
      sync_id: syncId,
      kind,
      created_at: new Date(r.createdAt).toISOString(),
      payload: r as unknown as Record<string, unknown>,
    }));
    const { error } = await supabase
      .from("records")
      .upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`Kirim ${kind} gagal: ${error.message}`);
    pushed += rows.length;
  }

  // Pull remote records this device is missing.
  pulled += await pullKind(syncId, "assessment", assessments, (p) =>
    putAssessment({ ...p, userId: localUserId } as unknown as Assessment)
  );
  pulled += await pullKind(syncId, "check_in", checkIns, (p) =>
    putCheckIn({ ...p, userId: localUserId } as unknown as CheckIn)
  );
  pulled += await pullKind(syncId, "workout_log", workoutLogs, (p) =>
    putWorkoutLog({ ...p, userId: localUserId } as unknown as WorkoutLog)
  );
  pulled += await pullKind(syncId, "pain_log", painLogs, (p) =>
    putPainLog({ ...p, userId: localUserId } as unknown as PainLog)
  );

  return { ran: true, pushed, pulled };
}

async function pullKind(
  syncId: string,
  kind: SyncKind,
  local: { id: string }[],
  write: (payload: Record<string, unknown>) => Promise<void>
): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("records")
    .select("id, sync_id, kind, created_at, payload")
    .eq("sync_id", syncId)
    .eq("kind", kind);
  if (error) throw new Error(`Ambil ${kind} gagal: ${error.message}`);

  const missing = idsToPull(local, (data as RecordRow[]) ?? []);
  await Promise.all(missing.map((row) => write(row.payload)));
  return missing.length;
}
