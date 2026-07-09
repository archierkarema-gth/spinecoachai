import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Assessment, User } from "@/lib/schemas";

/**
 * IndexedDB storage layer (docs/09_Tech_Architecture.md: "IndexedDB (MVP)").
 * Stores for every entity in docs/08_Data_Model.md are declared up front so
 * later milestones only need to add read/write helpers, not new stores.
 */

const DB_NAME = "spinecoach-ai";
const DB_VERSION = 1;

interface SpineCoachDB extends DBSchema {
  users: { key: string; value: User };
  assessments: {
    key: string;
    value: Assessment;
    indexes: { "by-userId": string };
  };
  goals: { key: string; value: unknown };
  exercises: { key: string; value: unknown };
  workoutPlans: { key: string; value: unknown };
  workoutLogs: { key: string; value: unknown };
  painLogs: { key: string; value: unknown };
  recoveryLogs: { key: string; value: unknown };
  photos: { key: string; value: unknown };
  medicalRecords: { key: string; value: unknown };
  reports: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<SpineCoachDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<SpineCoachDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SpineCoachDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("users", { keyPath: "id" });
        const assessments = db.createObjectStore("assessments", {
          keyPath: "id",
        });
        assessments.createIndex("by-userId", "userId");
        db.createObjectStore("goals", { keyPath: "id" });
        db.createObjectStore("exercises", { keyPath: "id" });
        db.createObjectStore("workoutPlans", { keyPath: "id" });
        db.createObjectStore("workoutLogs", { keyPath: "id" });
        db.createObjectStore("painLogs", { keyPath: "id" });
        db.createObjectStore("recoveryLogs", { keyPath: "id" });
        db.createObjectStore("photos", { keyPath: "id" });
        db.createObjectStore("medicalRecords", { keyPath: "id" });
        db.createObjectStore("reports", { keyPath: "id" });
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
