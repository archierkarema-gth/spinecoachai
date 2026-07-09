import { getSupabase } from "@/lib/supabase";
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
 * Optional cloud sync (docs/09 future). Offline-first: every function is a
 * no-op when Supabase isn't configured. Records are append-mostly and carry
 * client-generated UUIDs, so syncing is an id-keyed upsert in each direction
 * — no id remapping, no destructive overwrite.
 */

export interface SyncResult {
  ran: boolean;
  pushed: number;
  pulled: number;
}

/** A synced record as stored in a Supabase table row. */
interface RemoteRow {
  id: string;
  user_id: string;
  created_at: string;
  payload: unknown;
}

/**
 * Union two id-keyed collections, preferring the local copy on id conflict.
 * Pure and deterministic — the core of the merge, kept testable in isolation.
 */
export function mergeById<T extends { id: string }>(
  local: T[],
  remote: T[]
): T[] {
  const byId = new Map<string, T>();
  for (const r of remote) byId.set(r.id, r);
  for (const l of local) byId.set(l.id, l); // local wins
  return [...byId.values()];
}

/** Records in `remote` whose id is missing from `local` — the pull set. */
export function idsToPull<T extends { id: string }>(
  local: { id: string }[],
  remote: T[]
): T[] {
  const localIds = new Set(local.map((l) => l.id));
  return remote.filter((r) => !localIds.has(r.id));
}

const TABLES = {
  assessments: "assessments",
  checkIns: "check_ins",
  workoutLogs: "workout_logs",
  painLogs: "pain_logs",
} as const;

function toRow<T extends { id: string; createdAt: number }>(
  userId: string,
  record: T
): RemoteRow {
  return {
    id: record.id,
    user_id: userId,
    created_at: new Date(record.createdAt).toISOString(),
    payload: record,
  };
}

/**
 * Two-way sync for one user: upload local records the cloud is missing, then
 * download cloud records the device is missing. Local always wins on a shared
 * id, so nothing already on the device is clobbered.
 */
export async function syncAll(userId: string): Promise<SyncResult> {
  const supabase = getSupabase();
  if (!supabase) return { ran: false, pushed: 0, pulled: 0 };

  const [assessments, checkIns, workoutLogs, painLogs] = await Promise.all([
    getAssessmentsForUser(userId),
    getCheckInsForUser(userId),
    getWorkoutLogsForUser(userId),
    getPainLogsForUser(userId),
  ]);

  let pushed = 0;
  let pulled = 0;

  // Push every local record (upsert on id is idempotent).
  const pushGroups: [string, { id: string; createdAt: number }[]][] = [
    [TABLES.assessments, assessments],
    [TABLES.checkIns, checkIns],
    [TABLES.workoutLogs, workoutLogs],
    [TABLES.painLogs, painLogs],
  ];
  for (const [table, records] of pushGroups) {
    if (records.length === 0) continue;
    const rows = records.map((r) => toRow(userId, r));
    const { error } = await supabase.from(table).upsert(rows, {
      onConflict: "id",
    });
    if (error) throw new Error(`Push ${table} gagal: ${error.message}`);
    pushed += rows.length;
  }

  // Pull remote rows this device doesn't have yet, writing the stored payload
  // back into IndexedDB unchanged.
  pulled += await pullInto(
    supabase,
    TABLES.assessments,
    userId,
    assessments,
    (p) => putAssessment(p as Assessment)
  );
  pulled += await pullInto(
    supabase,
    TABLES.checkIns,
    userId,
    checkIns,
    (p) => putCheckIn(p as CheckIn)
  );
  pulled += await pullInto(
    supabase,
    TABLES.workoutLogs,
    userId,
    workoutLogs,
    (p) => putWorkoutLog(p as WorkoutLog)
  );
  pulled += await pullInto(
    supabase,
    TABLES.painLogs,
    userId,
    painLogs,
    (p) => putPainLog(p as PainLog)
  );

  return { ran: true, pushed, pulled };
}

async function pullInto(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  table: string,
  userId: string,
  local: { id: string }[],
  write: (payload: unknown) => Promise<void>
): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select("id, user_id, created_at, payload")
    .eq("user_id", userId);
  if (error) throw new Error(`Pull ${table} gagal: ${error.message}`);

  const missing = idsToPull(local, (data as RemoteRow[]) ?? []);
  await Promise.all(missing.map((row) => write(row.payload)));
  return missing.length;
}
