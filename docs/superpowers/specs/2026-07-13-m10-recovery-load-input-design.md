# M10 — Recovery Load Input (Design Spec)

Disusun 2026-07-13. Sumber: docs/11_Roadmap_M9-M14.md §M10 (Proposal P4).

## Tujuan

Menambah *previous workout load* sebagai sinyal ke keputusan intensitas
harian: kalau beban 48 jam terakhir berat **dan** pemulihan pas-pasan,
turunkan intensitas hari ini satu tingkat. Melengkapi loop reaktif-harian
(beban → pemulihan → intensitas) tanpa mengubah ceiling keselamatan.

## Prinsip yang dipatuhi (dari roadmap)

- Engine tetap murni, deterministik, tanpa network/model.
- Tidak menargetkan kurva, tidak mengestimasi Cobb.
- Safety/recovery selalu menang; jalur nyeri (`recovery` tier) tidak
  disentuh langkah ini.
- Tanpa field skema baru, tanpa store baru — pakai `workoutLogs` yang ada.

## Arsitektur & penempatan

`decideIntensity(checkIn)` tetap **murni** (hanya membaca check-in);
tes tier yang ada tidak berubah.

Fungsi baru, di-*export* untuk unit test:

```ts
applyLoadSuppression(
  base: SessionIntensity,
  checkIn: CheckIn,
  workoutLogs: WorkoutLog[],
  now: number,
): SessionIntensity
```

Alur di `generateSession`:

```
decideIntensity(checkIn) → applyLoadSuppression(base, checkIn, logs, now) → intensitas final
```

Dipanggil setelah `decideIntensity`, sebelum semua logika sesi. `now`
diturunkan dari `checkIn.createdAt`. `workoutLogs` dari `inputs.workoutLogs ?? []`.

## Metrik beban 48 jam

```
load = Σ  (log.estimatedMinutes × INTENSITY_WEIGHT[log.intensity])
       untuk setiap log dengan  0 ≤ now − log.createdAt < 48h
```

`INTENSITY_WEIGHT`:

| intensitas log | bobot |
|----------------|-------|
| recovery       | 0.25  |
| light          | 0.5   |
| moderate       | 0.75  |
| full           | 1.0   |

- Jendela: `now − log.createdAt` dalam `[0, 48*60*60*1000)`. Log dengan
  timestamp masa depan (selisih negatif) diabaikan.
- `HEAVY_LOAD_THRESHOLD = 45` (≈ 1,5 sesi penuh 30 menit). Konstanta modul,
  bisa disetel.

## Aturan penekanan

Turunkan **tepat satu tier** dengan pemetaan:

```
full     → moderate
moderate → light
```

**hanya bila SEMUA terpenuhi**:

1. `base ∈ {"full", "moderate"}` (bukan `recovery`/`light`), **dan**
2. `load ≥ HEAVY_LOAD_THRESHOLD`, **dan**
3. `checkIn.recovery ≤ 3`.

Kalau salah satu gagal → kembalikan `base` tanpa perubahan. `light` dan
`recovery` tidak pernah diturunkan lagi (recovery hanya jalur nyeri/safety).

## Reasoning

Saat penekanan benar-benar terjadi (tier berubah), `generateSession`
menambah satu baris reasoning:

> "Beban 2 hari terakhir cukup berat & pemulihan pas-pasan — turunkan satu tingkat hari ini."

Tidak ada baris kalau tidak ada penekanan.

## Testing (TDD)

Unit `applyLoadSuppression`:

- beban berat (≥45) + `recovery ≤ 3` + base `full` → `moderate`.
- beban berat + `recovery ≤ 3` + base `moderate` → `light`.
- beban berat + `recovery ≥ 4` → tidak turun (base kembali).
- beban ringan (<45) + `recovery ≤ 3` → tidak turun.
- base `light` → tetap `light`; base `recovery` → tetap `recovery`.
- batas jendela: log 49 jam lalu tidak dihitung; log 47 jam dihitung.
- bobot intensitas: sesi `light` panjang vs `full` pendek menghasilkan
  beban sesuai bobot.
- timestamp masa depan diabaikan.

Integrasi `generateSession`:

- input dengan dua sesi `full` 30 menit dalam 48 jam + `recovery` check-in
  rendah → intensitas final turun satu tier + baris reasoning muncul.
- input beban ringan → intensitas tidak berubah, tanpa baris reasoning.

## Bukan scope

- Rep counting (sesi berbasis durasi).
- Periodisasi / deload berkala (itu M13).
- Field skema baru atau tabel load terpisah.
