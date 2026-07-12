import type { User, Assessment } from "@/lib/schemas";

/**
 * One-time personal data import (user request, 2026-07-10).
 *
 * The owner completed an assessment on paper before this app existed; these
 * are those self-reported values, transcribed into the data model so the app
 * shows real history instead of an empty state. Applied by
 * `seedPersonalDataIfEmpty` in lib/db.ts, and only when the users store is
 * empty — a normal onboarding or an existing profile suppresses it.
 *
 * Nothing here is a diagnosis or a clinical measurement produced by the app:
 * the Cobb angles and curve description are the user's own doctor-reported
 * figures (docs/04_Clinical_Guardrails.md), stored verbatim as self-report.
 */

export const SEED_USER_ID = "seed-owner";

export const SEED_USER: Omit<User, "createdAt"> = {
  id: SEED_USER_ID,
  name: "Archie",
  age: 32,
  trainingPreset: "muscle-priority",
  ownedEquipment: ["pull-up bar"],
};

export const SEED_ASSESSMENT: Omit<
  Assessment,
  "id" | "userId" | "createdAt"
> = {
  diagnosedByPhysician: true,
  curveLocationSelfReported:
    "Didiagnosis dokter ~10th lalu (rontgen biasa). Kurva ganda T1–T12: thoracic atas 32° ke kiri (dekat bahu), thoracic bawah/lumbar 29° ke kanan.",

  painLevel: 5,
  painAreas: "Punggung atas",
  mobilityLimitations: "Tidak ada keterbatasan gerak yang spesifik.",

  activityLevel: "active",
  availableMinutesPerDay: 90,
  primaryGoals:
    "Postur tegap sempurna, tingkatkan kekuatan otot, dan bila memungkinkan kurangi derajat kurva. Semua latihan full bodyweight tanpa gym/beban — bisa dilakukan di rumah atau di mana saja.",

  redFlags: {
    neurologicalSymptoms: false,
    bowelBladderChanges: false,
    severeWorseningPain: false,
    trauma: false,
    feverWithSevereBackPain: false,
  },
};
