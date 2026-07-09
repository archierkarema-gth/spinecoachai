import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Assessment, User } from "@/lib/schemas";
import type { CheckIn, Exercise } from "@/lib/exercise-schemas";
import type { PainLog, WorkoutLog } from "@/lib/log-schemas";
import { EXERCISE_SEED } from "@/lib/exercise-seed";

/**
 * IndexedDB storage layer (docs/09_Tech_Architecture.md: "IndexedDB (MVP)").
 * Stores for every entity in docs/08_Data_Model.md are declared up front so
 * later milestones only need to add read/write helpers, not new stores.
 */

const DB_NAME = "spinecoach-ai";
const DB_VERSION = 3;

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
  recoveryLogs: { key: string; value: unknown };
  photos: { key: string; value: unknown };
  medicalRecords: { key: string; value: unknown };
  reports: { key: string; value: unknown };
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
          db.createObjectStore("photos", { keyPath: "id" });
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
 * Populate the exercises store from the seed the first time the app runs.
 * Idempotent: if any exercise already exists, nothing is written.
 */
export async function seedExercisesIfEmpty(): Promise<void> {
  const db = await getDB();
  const count = await db.count("exercises");
  if (count > 0) return;
  const tx = db.transaction("exercises", "readwrite");
  await Promise.all(EXERCISE_SEED.map((ex) => tx.store.put(ex)));
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
