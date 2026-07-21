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
  ownedEquipment: ["pull-up bar", "dip bars"],
};

export const SEED_ASSESSMENT: Omit<
  Assessment,
  "id" | "userId" | "createdAt"
> = {
  diagnosedByPhysician: true,
  // Corrected 2026-07-20 — owner confirmed the 27° figure used until now was
  // a transcription error; 29° / mid-lower thoracic (not lumbar) is
  // authoritative, per rontgen. Free-text summary kept alongside the
  // structured clinicalProfile below (both self-report, never computed by
  // the app — docs/04_Clinical_Guardrails.md).
  curveLocationSelfReported:
    "Double Major Curve (rontgen dokter, grade moderate). Kurva atas: thoracic proksimal T1–T5 (apex T3–T4), 32° konveks kiri (Sinistroscoliosis). Kurva utama: thoracic tengah-bawah T6–T12/L1 (apex T8–T9), 29° konveks kanan (Dextroscoliosis). ATR 8° (scoliometer), rib hump kanan menonjol pada Adam's Forward Bend Test.",
  clinicalProfile: {
    upperCurve: {
      location: "Thoracic proksimal T1–T5 (apex T3–T4)",
      cobbDegrees: 32,
      direction: "left",
    },
    mainCurve: {
      location: "Thoracic tengah-bawah T6–T12/L1 (apex T8–T9)",
      cobbDegrees: 29,
      direction: "right",
    },
    atrDegrees: 8,
    ribHumpSide: "right",
    clinicalGrade: "moderate",
    heightCm: 180,
    weightKg: 75,
    targetWeightKg: 75,
  },

  painLevel: 2,
  painAreas: "Punggung kanan (nyeri ringan)",
  mobilityLimitations: "Tidak ada keterbatasan gerak yang spesifik.",

  activityLevel: "active",
  availableMinutesPerDay: 90,
  primaryGoals:
    "Postur tegap sempurna, tingkatkan kekuatan otot, dan bila memungkinkan kurangi derajat kurva. Semua latihan full bodyweight tanpa gym/beban — bisa dilakukan di rumah atau di mana saja. Level saat ini pemula-intermediate: pull-up 8–10 rep, dips 6–8 rep. Target frekuensi 5–6 hari/minggu (Senin–Sabtu). Progressive calisthenics jangka panjang — jangan mentok di gerakan pemula, terus naik ke variasi lanjut selama form bersih & tanpa nyeri.",

  redFlags: {
    neurologicalSymptoms: false,
    bowelBladderChanges: false,
    severeWorseningPain: false,
    trauma: false,
    feverWithSevereBackPain: false,
  },
};
