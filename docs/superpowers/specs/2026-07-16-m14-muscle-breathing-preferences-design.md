# M14 — Preferensi Otot & Napas (Design Spec)

Disusun 2026-07-16. Sumber: docs/11_Roadmap_M9-M14.md §M14 (Proposal
P1-subset + P3-lite). Bergantung pada M11 (retag library sekali kerja).

## Tujuan

Tiga sinyal baru, semua opsional/backward-compatible:

1. **`muscles[]` tag** di skema exercise — grup otot primer yang disasar
   tiap gerakan.
2. **`weakMuscles[]` / `tightMuscles[]` / `breathingPattern`** — preferensi
   profil (bukan data klinis kurva) yang bias urutan pemilihan gerakan
   dalam domain, tidak mengubah jumlah slot per domain.
3. **Volume mingguan per domain** — sinyal tampilan (display-only) di
   Progress page dari `workoutLogs` yang sudah ada.

## Prinsip yang dipatuhi (dari roadmap)

- Engine tetap murni, deterministik, tanpa network/model.
- Tidak pernah menargetkan kurva/mengestimasi Cobb — `muscles[]` adalah
  grup otot generik (glute, hamstring, dst), bukan segmen tulang belakang.
- Safety/recovery selalu menang; korektif tidak pernah nol — bias muscle
  preference tidak mengubah `slotMaxFor`/domain gating, cuma urutan dalam
  domain yang sudah dipilih oleh mekanisme existing.
- Field baru selalu optional + default; tanpa migrasi paksa IndexedDB.
- Kalau user belum isi preferensi, behavior identik dengan sebelum M14.

## Taksonomi muscle group

15 grup tetap (union tipe, dipakai baik di `muscles[]` exercise maupun
`weakMuscles`/`tightMuscles` profil):

```ts
type MuscleGroup =
  | "hip-flexor" | "hamstring" | "glute" | "quad" | "calf" | "adductor"
  | "core" | "lower-back" | "upper-back" | "lat" | "trap"
  | "shoulder" | "rotator-cuff" | "chest" | "neck";
```

## Bagian A — Skema

### Exercise (`src/lib/exercise-schemas.ts`)

```ts
exerciseSchema: {
  ...,
  muscles: MuscleGroup[], // default [], 1-3 tag primer per gerakan
}
```

Optional dengan default `[]` — data lama (belum di-retag) tidak pecah
validasi, cuma tidak dapat bias.

### Profil (`src/lib/schemas.ts`)

Field baru di `Assessment` (mengikuti pola field profil existing seperti
`mobilityLimitations`):

```ts
Assessment: {
  ...,
  weakMuscles?: MuscleGroup[],
  tightMuscles?: MuscleGroup[],
  breathingPattern?: "chest-dominant" | "diaphragmatic" | "shallow" | "not-sure",
}
```

Semua optional, tanpa default paksa (`undefined` = belum diisi, beda dari
`[]` = diisi tapi kosong). `weakMuscles` dan `tightMuscles` boleh overlap
antar grup berbeda (mis. hip-flexor tight + glute weak) — tidak divalidasi
silang.

## Bagian B — UI: Onboarding Assessment Form

Ditambahkan ke form assessment awal (bukan reassessment mingguan M13 —
preferensi ini relatif stabil, tidak berubah tiap minggu):

- Checklist multi-select `weakMuscles` (15 opsi, grup di atas).
- Checklist multi-select `tightMuscles` (15 opsi sama).
- Radio/select `breathingPattern`, 4 opsi, default terpilih `"not-sure"`.

Semua field opsional — user boleh skip tanpa isi apapun (`undefined`
tersimpan), form tetap bisa submit.

## Bagian C — Retag Library

`src/lib/exercise-seed.ts` (60-80 gerakan pasca-M11): tiap entry dapat
`muscles: MuscleGroup[]` 1-3 tag primer (target utama gerakan, bukan
seluruh otot yang kesentuh secara sekunder).

## Bagian D — Engine Bias

`src/lib/decision-engine.ts`, `pickForDomain` (baris ~365):

```ts
interface PickOptions {
  ...,
  preferMuscles?: Set<MuscleGroup>; // dari weakMuscles (semua domain)
  preferMusclesInMobility?: Set<MuscleGroup>; // dari tightMuscles (domain mobility saja)
}
```

- Sort `byPreference` (baris ~391) dapat secondary key: exercise dengan
  `muscles` overlap `preferMuscles` naik prioritas (di atas exercise
  non-overlap pada rank difficulty yang sama). Primary key difficulty
  window tetap tidak berubah.
- `preferMusclesInMobility` (dari `tightMuscles`) hanya dipakai saat
  `domain === "mobility"` — supaya tidak kontradiksi dengan strength
  building untuk otot yang sama ditandai "weak" di domain strength.
- Tidak mengubah `slotMaxFor`, `boosted`, atau jumlah slot per domain —
  murni urutan pilihan exercise dalam domain yang sudah ditentukan
  mekanisme existing (goal weights M9-M13 tidak disentuh).

`generateSession` (baris ~419): saat memanggil `pickForDomain` per step,
teruskan `preferMuscles: new Set(assessment.weakMuscles ?? [])` dan
`preferMusclesInMobility: new Set(assessment.tightMuscles ?? [])`.

### `breathingPattern`

- `"chest-dominant"` atau `"shallow"` → tambah reasoning line (mirip pola
  M13 breathingQuality rendah), **tidak** re-derive goal weight baru
  (breathingQuality M13 sudah menghandle jalur itu — hindari duplikasi
  sinyal breathing yang sama).
- Tidak mengubah `deriveGoalWeights` maupun `slotMaxFor`.
- `"diaphragmatic"` / `"not-sure"` → tidak ada efek/reasoning line.

## Bagian E — Volume Mingguan per Domain (P3-lite, display-only)

Helper baru `src/lib/progress.ts`:

```ts
weeklyVolumeByDomain(
  workoutLogs: WorkoutLog[],
  now: number,
): Record<ExerciseDomain, number> // total detik, 7 hari terakhir
```

- Iterasi `workoutLogs` 7 hari terakhir dari `now`, jumlahkan
  `estimatedMinutes` (atau breakdown per `completedExercise.domain` kalau
  durasi per-exercise tersedia — pakai `durationSeconds` dari exercise
  seed di-join lewat `exerciseId` bila log tidak simpan durasi per baris).
- Render di `src/app/progress/page.tsx` sebagai bar/list sederhana per
  domain (8 domain existing: breathing, mobility, stability, core,
  balance, strength, conditioning, recovery).
- **Tidak** dikonsumsi oleh `generateSession` — murni tampilan, tidak ada
  feedback loop ke engine (menghindari interaksi tak terduga dengan
  goal-weight boosting yang sudah ada).

## Bukan scope (keseluruhan M14)

- Muscle-level volume tracking penuh (hanya domain-level volume, Bagian E).
- Korelasi biomekanik/kurva dari muscle tag (dilarang guardrail).
- Validasi silang antara `weakMuscles`/`tightMuscles` (boleh overlap grup
  berbeda tanpa dicek).
- Perubahan `slotMaxFor`/jumlah slot domain dari muscle preference —
  hanya urutan pilihan dalam domain.
- UI edit preferensi di luar onboarding assessment (tidak ada halaman
  profil terpisah untuk update `weakMuscles`/`tightMuscles`/
  `breathingPattern` setelah onboarding — revisi lewat re-isi assessment
  kalau perlu, sama seperti field assessment lain saat ini).
- Volume-per-domain memengaruhi seleksi engine (Bagian E strictly
  display-only per keputusan brainstorm).

## Testing (TDD)

Unit `pickForDomain` (extend existing test):

- tanpa `preferMuscles`/`preferMusclesInMobility` → hasil identik test
  lama.
- `preferMuscles` overlap salah satu kandidat pada rank difficulty sama →
  kandidat overlap terpilih lebih dulu.
- `preferMusclesInMobility` hanya berefek saat domain `"mobility"`, tidak
  berefek di domain `"strength"` meski exercise punya `muscles` yang sama.

Unit `weeklyVolumeByDomain`:

- workoutLogs kosong → semua domain 0.
- logs di luar window 7 hari → tidak dihitung.
- logs campuran domain → total per domain sesuai breakdown.

Integrasi `generateSession`:

- `assessment.weakMuscles` diisi → exercise dengan `muscles` overlap
  muncul lebih dulu di domain terkait (dibanding tanpa preferensi).
- `assessment.breathingPattern === "chest-dominant"` → reasoning line
  breathing muncul, goal weights tidak berubah dibanding baseline tanpa
  field ini.

Schema:

- `Assessment` tanpa `weakMuscles`/`tightMuscles`/`breathingPattern` →
  valid (semua optional).
- `exerciseSchema` tanpa `muscles` → default `[]`, valid (data lama tidak
  pecah).
