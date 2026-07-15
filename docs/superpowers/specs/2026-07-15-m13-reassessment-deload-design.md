# M13 — Weekly Reassessment + Deload Berkala (Design Spec)

Disusun 2026-07-15. Sumber: docs/11_Roadmap_M9-M14.md §M13 (Proposal P5 + P8-lite).

## Tujuan

Dua sinyal baru masuk ke engine, keduanya opsional/backward-compatible:

1. **Weekly reassessment** — self-report ringan mingguan (fleksibilitas,
   keseimbangan, kualitas napas, pain areas) yang me-re-derive goal weights,
   supaya program tetap nyambung ke kondisi user minggu ini, bukan cuma
   assessment awal yang statis.
2. **Deload berkala** — kalau beban 4 minggu berturut-turut konsisten
   moderate/full, minggu berikutnya otomatis di-cap ke intensitas `light`
   (preventif), menggantikan periodisasi kaku yang sudah ditolak roadmap.

## Prinsip yang dipatuhi (dari roadmap)

- Engine tetap murni, deterministik, tanpa network/model.
- Tidak menargetkan kurva, tidak mengestimasi Cobb.
- Safety/recovery selalu menang; jalur nyeri (`recovery` tier) tidak
  disentuh oleh deload cap.
- Field baru selalu optional + default; tanpa migrasi paksa data lama.
- Kalau user belum pernah isi reassessment, behavior identik dengan
  sebelum M13 (no-op).

## Bagian A — Weekly Reassessment

### Skema & storage

Store IndexedDB baru `reassessmentLogs`, `DB_VERSION` naik ke 6, pola sama
seperti `benchmarkLogs` (`src/lib/db.ts`, `src/lib/log-schemas.ts`).

```ts
reassessmentLogSchema = {
  id: string,
  userId: string,
  createdAt: number,
  flexibility: 1 | 2 | 3 | 4 | 5,
  balance: 1 | 2 | 3 | 4 | 5,
  breathingQuality: 1 | 2 | 3 | 4 | 5,
  painAreas?: string,   // reuse pola Assessment.painAreas (max 300 char)
}
```

Index `by-userId`. Riwayat historis tersimpan (bukan overwrite) —
konsisten pola log-store lain, memungkinkan tren di Progress page nanti
(di luar scope M13, tapi data-nya sudah siap).

### Trigger UI

- Cek `reassessmentLogs` terakhir milik user.
- Kalau belum pernah isi, atau `now - lastReassessment.createdAt ≥ 7 hari`
  → tampilkan banner/prompt sebelum user mulai sesi baru.
- Non-blocking: user bisa dismiss/skip, sesi tetap bisa dimulai tanpa isi.
- Form: 3 slider/rating 1-5 (flexibility, balance, breathingQuality) +
  1 textarea opsional (painAreas).

### Re-derive goal weights

`deriveGoalWeights()` di `src/lib/decision-engine.ts` di-extend menerima
parameter opsional `latestReassessment?: ReassessmentLog`:

```ts
deriveGoalWeights(
  assessment: Assessment,
  latestReassessment?: ReassessmentLog,
): GoalWeights
```

Setelah keyword-scan existing (`GOAL_KEYWORDS` atas `primaryGoals`) jalan
seperti biasa, tambahkan modifier:

| kondisi                          | efek                                   |
|-----------------------------------|-----------------------------------------|
| `flexibility ≤ 2`                 | naikkan weight goal kategori mobility  |
| `balance ≤ 2`                     | naikkan weight goal kategori stability/unilateral |
| `breathingQuality ≤ 2`            | naikkan weight goal kategori breathing/relaxation (kalau kategori ini ada di `GOAL_KEYWORDS`; kalau tidak ada, skip — tidak menambah kategori baru di M13) |

Modifier bersifat **tambahan** (menaikkan weight yang sudah ada dari hasil
keyword-scan), bukan menggantikan. Kalau `latestReassessment` tidak
diberikan (`undefined`), fungsi berperilaku identik dengan sebelum M13.

Tidak menyentuh `deriveCapability()` / `floorRank` — capability floor
tetap murni dari `activityLevel` + `workoutLogs` seperti sekarang.

### Bukan scope (Bagian A)

- Tidak ada perubahan capability floor dari reassessment.
- Tidak ada UI riwayat/tren reassessment di Progress page (data sudah
  tersimpan untuk dipakai nanti).
- Tidak ada validasi/blocking kalau user tidak pernah reassess.

## Bagian B — Deload Berkala

### Deteksi trigger

Fungsi baru, di-*export* untuk unit test, murni membaca `workoutLogs`:

```ts
shouldDeload(workoutLogs: WorkoutLog[], now: number): boolean
```

Alur:

1. Bagi 28 hari terakhir (`now - 28*24h` s.d. `now`) jadi 4 jendela
   mingguan berurutan (7 hari per jendela, jendela ke-4 paling baru).
2. Tiap jendela: hitung rata-rata `intensity` sesi dalam jendela tsb
   (skip jendela kosong dari perhitungan "konsisten" — jendela kosong
   dianggap tidak memenuhi syarat, supaya user baru tidak ke-trigger).
3. `shouldDeload = true` bila **semua 4 jendela** punya avg intensity
   ≥ `moderate` (`INTENSITY_WEIGHT` dari M10: moderate=0.75, full=1.0 —
   threshold avg ≥ 0.75) DAN setiap jendela punya minimal 1 sesi.
4. Kalau minggu berjalan **sudah** deload (lihat state di bawah), jangan
   trigger deload lagi berturut-turut — reset butuh minimal 1 minggu
   non-deload di antaranya secara alami karena deload week meng-cap
   intensity ke light, sehingga jendela deload otomatis tidak
   memenuhi syarat "≥ moderate" untuk siklus berikutnya.

### Efek cap intensitas

Fungsi baru:

```ts
applyDeloadCap(
  intensity: SessionIntensity,
  isDeloadWeek: boolean,
): SessionIntensity
```

- Bila `isDeloadWeek === true` dan `intensity ∈ {"full", "moderate"}` →
  turunkan ke `"light"`.
- Bila `intensity` sudah `"light"` atau `"recovery"` → tidak berubah
  (cap hanya menurunkan, tidak pernah menaikkan — recovery tetap menang).

### Penempatan di alur `generateSession`

```
decideIntensity(checkIn)
  → applyLoadSuppression(base, checkIn, logs, now)   // M10, existing
  → applyDeloadCap(result, shouldDeload(logs, now))  // M13, baru
  → intensitas final
```

Dipanggil paling akhir, setelah M10 load-suppression — deload adalah cap
tambahan di atas semua logika intensitas yang sudah ada.

### Reasoning

Saat `applyDeloadCap` benar-benar mengubah tier:

> "Beban latihan konsisten tinggi 4 minggu terakhir — minggu ini deload, turunkan volume buat recovery."

Tidak ada baris kalau tidak ada perubahan (termasuk kalau `isDeloadWeek`
true tapi intensity sudah light/recovery — tidak ada line, karena tidak
ada perubahan nyata untuk direasoning-kan).

### Bukan scope (Bagian B)

- Tidak memotong durasi/jumlah exercise secara terpisah dari intensity
  tier — efek deload murni lewat cap intensitas (`light`), konsisten
  dengan mekanisme intensity yang sudah menentukan volume sesi.
- Tidak ada UI khusus "deload mode" selain reasoning line.
- Tidak ada override manual dari user untuk skip/force deload.

## Testing (TDD)

Unit `deriveGoalWeights` (extend existing test):

- tanpa `latestReassessment` → hasil identik test lama.
- `flexibility ≤ 2` → weight mobility naik dibanding baseline.
- `balance ≤ 2` → weight stability naik.
- `breathingQuality ≤ 2` → weight breathing naik (jika kategori ada).
- semua skor ≥ 3 → tidak ada modifier, hasil sama seperti tanpa
  reassessment.

Unit `shouldDeload`:

- 4 minggu berturut avg ≥ moderate (semua jendela terisi) → `true`.
- 1 dari 4 minggu avg < moderate → `false`.
- jendela kosong (tidak ada sesi minggu itu) → `false`.
- kurang dari 28 hari data (user baru) → `false`.

Unit `applyDeloadCap`:

- `isDeloadWeek=true`, intensity `full` → `light`.
- `isDeloadWeek=true`, intensity `moderate` → `light`.
- `isDeloadWeek=true`, intensity `light`/`recovery` → tidak berubah.
- `isDeloadWeek=false` → intensity tidak berubah apapun nilainya.

Integrasi `generateSession`:

- input 4 minggu logs konsisten full/moderate → intensitas final `light`
  + baris reasoning deload muncul.
- input dengan reassessment flexibility rendah → sesi menunjukkan bias
  goal weight ke mobility (exercise selection berubah sesuai weight).

## Bukan scope (keseluruhan M13)

- Rep counting, periodisasi kaku 6-minggu (sudah ditolak roadmap).
- Perubahan capability floor dari reassessment.
- UI tren/riwayat reassessment di Progress page.
- Override manual deload oleh user.
