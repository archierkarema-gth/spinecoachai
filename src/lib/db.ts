import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Assessment, User } from "@/lib/schemas";
import type { CheckIn, Exercise } from "@/lib/exercise-schemas";
import type {
  AsymmetryLog,
  BenchmarkLog,
  KegelLog,
  PainLog,
  ReassessmentLog,
  RibHumpLog,
  SessionLog,
  WorkoutLog,
} from "@/lib/log-schemas";
import type { Photo } from "@/lib/media-schemas";
import type { SchrothLog } from "@/lib/schroth-schemas";
import { NORMALIZED_EXERCISE_SEED } from "@/lib/exercise-seed";
import { SEED_USER, SEED_ASSESSMENT } from "@/lib/personal-seed";

/**
 * IndexedDB storage layer (docs/09_Tech_Architecture.md: "IndexedDB (MVP)").
 * Stores for every entity in docs/08_Data_Model.md are declared up front so
 * later milestones only need to add read/write helpers, not new stores.
 */

const DB_NAME = "spinecoach-ai";
const DB_VERSION = 9;

interface SpineCoachDB extends DBSchema {
  users: { key: string; value: User };
  assessments: {
    key: string;
    value: Assessment;
    indexes: { "by-userId": string };
  };
  checkIns: {
    key: string;
    value: CheckIn;
    indexes: { "by-userId": string };
  };
  goals: { key: string; value: unknown };
  exercises: { key: string; value: Exercise };
  workoutPlans: { key: string; value: unknown };
  workoutLogs: {
    key: string;
    value: WorkoutLog;
    indexes: { "by-userId": string };
  };
  painLogs: {
    key: string;
    value: PainLog;
    indexes: { "by-userId": string };
  };
  benchmarkLogs: {
    key: string;
    value: BenchmarkLog;
    indexes: { "by-userId": string };
  };
  reassessmentLogs: {
    key: string;
    value: ReassessmentLog;
    indexes: { "by-userId": string };
  };
  recoveryLogs: { key: string; value: unknown };
  photos: {
    key: string;
    value: Photo;
    indexes: { "by-userId": string };
  };
  medicalRecords: { key: string; value: unknown };
  reports: { key: string; value: unknown };
  schrothLogs: {
    key: string;
    value: SchrothLog;
    indexes: { "by-userId": string };
  };
  // M16 (spec §6.2, §3).
  sessionLogs: {
    key: string;
    value: SessionLog;
    indexes: { "by-userId": string };
  };
  asymmetryLogs: {
    key: string;
    value: AsymmetryLog;
    indexes: { "by-userId": string };
  };
  // M16 §9 trackers / §8 timers.
  ribHumpLogs: {
    key: string;
    value: RibHumpLog;
    indexes: { "by-userId": string };
  };
  kegelLogs: {
    key: string;
    value: KegelLog;
    indexes: { "by-userId": string };
  };
}

let dbPromise: Promise<IDBPDatabase<SpineCoachDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<SpineCoachDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SpineCoachDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore("users", { keyPath: "id" });
          const assessments = db.createObjectStore("assessments", {
            keyPath: "id",
          });
          assessments.createIndex("by-userId", "userId");
          db.createObjectStore("goals", { keyPath: "id" });
          db.createObjectStore("exercises", { keyPath: "id" });
          db.createObjectStore("workoutPlans", { keyPath: "id" });
          const workoutLogs = db.createObjectStore("workoutLogs", {
            keyPath: "id",
          });
          workoutLogs.createIndex("by-userId", "userId");
          const painLogs = db.createObjectStore("painLogs", { keyPath: "id" });
          painLogs.createIndex("by-userId", "userId");
          db.createObjectStore("recoveryLogs", { keyPath: "id" });
          const photos = db.createObjectStore("photos", { keyPath: "id" });
          photos.createIndex("by-userId", "userId");
          db.createObjectStore("medicalRecords", { keyPath: "id" });
          db.createObjectStore("reports", { keyPath: "id" });
        }
        if (oldVersion < 2) {
          const checkIns = db.createObjectStore("checkIns", { keyPath: "id" });
          checkIns.createIndex("by-userId", "userId");
        }
        if (oldVersion >= 1 && oldVersion < 3) {
          // Stores existed since v1 without the by-userId index; add it now.
          tx.objectStore("workoutLogs").createIndex("by-userId", "userId");
          tx.objectStore("painLogs").createIndex("by-userId", "userId");
        }
        if (oldVersion >= 1 && oldVersion < 4) {
          tx.objectStore("photos").createIndex("by-userId", "userId");
        }
        if (oldVersion < 5) {
          const benchmarkLogs = db.createObjectStore("benchmarkLogs", {
            keyPath: "id",
          });
          benchmarkLogs.createIndex("by-userId", "userId");
        }
        if (oldVersion < 6) {
          const reassessmentLogs = db.createObjectStore("reassessmentLogs", {
            keyPath: "id",
          });
          reassessmentLogs.createIndex("by-userId", "userId");
        }
        if (oldVersion < 7) {
          const schrothLogs = db.createObjectStore("schrothLogs", {
            keyPath: "id",
          });
          schrothLogs.createIndex("by-userId", "userId");
        }
        if (oldVersion < 8) {
          const sessionLogs = db.createObjectStore("sessionLogs", {
            keyPath: "id",
          });
          sessionLogs.createIndex("by-userId", "userId");
          const asymmetryLogs = db.createObjectStore("asymmetryLogs", {
            keyPath: "id",
          });
          asymmetryLogs.createIndex("by-userId", "userId");
        }
        if (oldVersion < 9) {
          const ribHumpLogs = db.createObjectStore("ribHumpLogs", {
            keyPath: "id",
          });
          ribHumpLogs.createIndex("by-userId", "userId");
          const kegelLogs = db.createObjectStore("kegelLogs", {
            keyPath: "id",
          });
          kegelLogs.createIndex("by-userId", "userId");
        }
      },
    });
  }
  return dbPromise;
}

export async function putUser(user: User): Promise<void> {
  const db = await getDB();
  await db.put("users", user);
}

export async function getUser(id: string): Promise<User | undefined> {
  const db = await getDB();
  return db.get("users", id);
}

export async function getFirstUser(): Promise<User | undefined> {
  const db = await getDB();
  const all = await db.getAll("users");
  return all[0];
}

export async function putAssessment(assessment: Assessment): Promise<void> {
  const db = await getDB();
  await db.put("assessments", assessment);
}

export async function getAssessmentsForUser(
  userId: string
): Promise<Assessment[]> {
  const db = await getDB();
  return db.getAllFromIndex("assessments", "by-userId", userId);
}

export async function getLatestAssessmentForUser(
  userId: string
): Promise<Assessment | undefined> {
  const all = await getAssessmentsForUser(userId);
  return all.sort((a, b) => b.createdAt - a.createdAt)[0];
}

/**
 * Import the owner's pre-existing (paper) assessment when the app has a profile
 * but no assessment on record — the reported state where the user onboarded
 * before the assessment form existed. Attaches the assessment to the existing
 * user if there is one; otherwise creates the seed profile too.
 *
 * Idempotent and non-destructive: it writes only when zero assessments exist,
 * so once the owner has any assessment (this seed or a real one) it never runs
 * again and never clobbers real data. See lib/personal-seed.ts for provenance.
 */
export async function seedPersonalDataIfEmpty(): Promise<void> {
  const db = await getDB();
  if ((await db.count("assessments")) > 0) return;

  const now = Date.now();
  const existing = (await db.getAll("users"))[0];
  const userId = existing?.id ?? SEED_USER.id;
  if (!existing) {
    await db.put("users", { ...SEED_USER, createdAt: now });
  }
  await db.put("assessments", {
    ...SEED_ASSESSMENT,
    id: crypto.randomUUID(),
    userId,
    createdAt: now,
  });
}

/**
 * Sync the exercises store with the seed: upsert every seed entry by id.
 * Unlike the old empty-store-only seeding (`seedExercisesIfEmpty`), this also
 * reaches installs whose store was populated by an earlier app version — new
 * library exercises show up without a reinstall. Safe to run on every hydrate:
 * - the store is app-owned (no UI mutates exercises), so overwriting by id
 *   only refreshes seed data, never user data;
 * - progression duration bumps are computed at session generation (the engine
 *   clones), never written back to the store, so nothing earned is lost;
 * - ids not in the seed (none are created today) are left untouched.
 */
export async function syncSeedExercises(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("exercises", "readwrite");
  await Promise.all(NORMALIZED_EXERCISE_SEED.map((ex) => tx.store.put(ex)));
  await tx.done;
}

export async function getAllExercises(): Promise<Exercise[]> {
  const db = await getDB();
  return db.getAll("exercises");
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  const db = await getDB();
  return db.get("exercises", id);
}

export async function putCheckIn(checkIn: CheckIn): Promise<void> {
  const db = await getDB();
  await db.put("checkIns", checkIn);
}

export async function getCheckInsForUser(userId: string): Promise<CheckIn[]> {
  const db = await getDB();
  return db.getAllFromIndex("checkIns", "by-userId", userId);
}

export async function getLatestCheckInForUser(
  userId: string
): Promise<CheckIn | undefined> {
  const all = await getCheckInsForUser(userId);
  return all.sort((a, b) => b.createdAt - a.createdAt)[0];
}

export async function putWorkoutLog(log: WorkoutLog): Promise<void> {
  const db = await getDB();
  await db.put("workoutLogs", log);
}

/** Workout logs for a user, newest first. */
export async function getWorkoutLogsForUser(
  userId: string
): Promise<WorkoutLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("workoutLogs", "by-userId", userId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putPainLog(log: PainLog): Promise<void> {
  const db = await getDB();
  await db.put("painLogs", log);
}

/** Pain logs for a user, newest first. */
export async function getPainLogsForUser(userId: string): Promise<PainLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("painLogs", "by-userId", userId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putBenchmarkLog(log: BenchmarkLog): Promise<void> {
  const db = await getDB();
  await db.put("benchmarkLogs", log);
}

/** Benchmark logs for a user, newest first. */
export async function getBenchmarkLogsForUser(
  userId: string
): Promise<BenchmarkLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("benchmarkLogs", "by-userId", userId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putReassessmentLog(log: ReassessmentLog): Promise<void> {
  const db = await getDB();
  await db.put("reassessmentLogs", log);
}

/** Reassessment logs for a user, newest first. */
export async function getReassessmentLogsForUser(
  userId: string
): Promise<ReassessmentLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(
    "reassessmentLogs",
    "by-userId",
    userId
  );
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getLatestReassessmentForUser(
  userId: string
): Promise<ReassessmentLog | undefined> {
  const all = await getReassessmentLogsForUser(userId);
  return all[0];
}

export async function putPhoto(photo: Photo): Promise<void> {
  const db = await getDB();
  await db.put("photos", photo);
}

/** Progress photos for a user, newest first. */
export async function getPhotosForUser(userId: string): Promise<Photo[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("photos", "by-userId", userId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("photos", id);
}

export async function putSchrothLog(log: SchrothLog): Promise<void> {
  const db = await getDB();
  await db.put("schrothLogs", log);
}

/** Schroth checklist logs for a user, newest first. */
export async function getSchrothLogsForUser(
  userId: string
): Promise<SchrothLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("schrothLogs", "by-userId", userId);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Today's Schroth checklist for a user (by local dateKey), if any. */
export async function getSchrothLogForDate(
  userId: string,
  dateKey: string
): Promise<SchrothLog | undefined> {
  const all = await getSchrothLogsForUser(userId);
  return all.find((l) => l.dateKey === dateKey);
}

export async function putSessionLog(log: SessionLog): Promise<void> {
  const db = await getDB();
  await db.put("sessionLogs", log);
}

/** Session logs for a user, newest first (spec §6.2). */
export async function getSessionLogsForUser(
  userId: string
): Promise<SessionLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("sessionLogs", "by-userId", userId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/** Session logs for one exercise, newest first — feeds auto-promotion (§6.3). */
export async function getSessionLogsForExercise(
  userId: string,
  exerciseId: string
): Promise<SessionLog[]> {
  const all = await getSessionLogsForUser(userId);
  return all.filter((l) => l.exerciseId === exerciseId);
}

export async function putAsymmetryLog(log: AsymmetryLog): Promise<void> {
  const db = await getDB();
  await db.put("asymmetryLogs", log);
}

/** Asymmetry safety logs for a user, newest first (spec §3, §6.6). */
export async function getAsymmetryLogsForUser(
  userId: string
): Promise<AsymmetryLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("asymmetryLogs", "by-userId", userId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/** Mark an asymmetry log reviewed/unreviewed (dashboard safety strip). */
export async function setAsymmetryReviewed(
  id: string,
  reviewed: boolean
): Promise<void> {
  const db = await getDB();
  const existing = await db.get("asymmetryLogs", id);
  if (!existing) return;
  await db.put("asymmetryLogs", { ...existing, reviewed });
}

export async function putRibHumpLog(log: RibHumpLog): Promise<void> {
  const db = await getDB();
  await db.put("ribHumpLogs", log);
}

/** Rib-hump logs for a user, newest first (spec §9.2, log-only). */
export async function getRibHumpLogsForUser(
  userId: string
): Promise<RibHumpLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("ribHumpLogs", "by-userId", userId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putKegelLog(log: KegelLog): Promise<void> {
  const db = await getDB();
  await db.put("kegelLogs", log);
}

/** Kegel logs for a user, newest first (spec §7 daily count). */
export async function getKegelLogsForUser(userId: string): Promise<KegelLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("kegelLogs", "by-userId", userId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Wipe every user-generated record (Settings → reset). Leaves the exercises
 * store intact so the app still has its library on next load.
 */
export async function resetUserData(): Promise<void> {
  const db = await getDB();
  const stores = [
    "users",
    "assessments",
    "checkIns",
    "goals",
    "workoutPlans",
    "workoutLogs",
    "painLogs",
    "benchmarkLogs",
    "reassessmentLogs",
    "recoveryLogs",
    "photos",
    "medicalRecords",
    "reports",
    "schrothLogs",
    "sessionLogs",
    "asymmetryLogs",
    "ribHumpLogs",
    "kegelLogs",
  ] as const;
  const tx = db.transaction(stores, "readwrite");
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  await tx.done;
}
