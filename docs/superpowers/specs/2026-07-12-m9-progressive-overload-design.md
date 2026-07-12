# M9 — Progressive Overload Engine (Design Spec)

Tanggal: 2026-07-12
Sumber: docs/11_Roadmap_M9-M14.md (M9, Proposal P2)
Guardrail: docs/04 (Clinical Guardrails), docs/05 (AI Decision Engine)

## Tujuan

Membuat engine benar-benar mendorong adaptasi jangka panjang per-gerakan.
Saat ini `progressionId`/`regressionId` ada di seed tapi hanya teks; durasi
gerakan statik. M9 menambah lapisan **overload durasi per-gerakan** di atas
difficulty-floor global yang sudah ada (`deriveCapability`), tanpa perubahan
skema dan tanpa store baru.

## Prinsip yang dipatuhi

- Engine tetap murni, deterministik, tanpa network/model.
- Tidak menargetkan kurva; tidak mengestimasi Cobb.
- Safety/recovery menang atas performa; korektif tidak pernah nol.
- Tanpa migrasi IndexedDB (nol field skema baru).

## Keputusan desain (hasil brainstorm)

1. **Pelacakan durasi** = derivasi murni dari `workoutLogs` (opsi A). Tanpa
   field baru. Durasi tersuruh dihitung ulang tiap sesi dari hitungan sesi
   bersih beruntun.
2. **Saat plafon durasi tercapai & tetap bersih** = auto-swap ke
   `progressionId`, tetapi **hanya saat `intensity === "full"`** (opsi 3).
3. **Regresi** = andalkan floor global `deriveCapability` yang sudah ada
   (opsi 2). M9 = progresi-per-gerakan saja; tidak ada regresi per-gerakan
   baru.
4. **Parameter (moderat)**: 2 sesi bersih per step, +15 dtk/step, plafon
   +45 dtk.

## Definisi "sesi bersih" untuk gerakan X

Sebuah `WorkoutLog` dihitung bersih untuk gerakan X bila:
- log memuat entri dengan `exerciseId === X`, dan
- entri itu `completed === true`, dan
- `(log.postSessionPain ?? 0) <= 3`.

Ambang nyeri `<= 3` sengaja disamakan dengan `cleanStreak` di
`deriveCapability` supaya definisi "bersih" konsisten di seluruh engine.

## Komponen (fungsi murni, diekspor untuk unit test)

### `countCleanStreak(exerciseId: string, logs: WorkoutLog[]): number`

Logs newest-first. Iterasi dari terbaru:
- Sesi di mana gerakan **absen** → dilewati (tidak menambah, tidak memutus).
  Rasional: pada hari intensitas rendah / waktu pendek, gerakan bisa hilang
  dari sesi; itu bukan kegagalan.
- Sesi di mana gerakan **hadir & bersih** → `streak += 1`.
- Sesi di mana gerakan **hadir & tidak bersih** (tak selesai atau nyeri>3)
  → berhenti; kembalikan streak sejauh ini.

Gerakan yang belum pernah tercatat → streak 0.

### `progressedDuration(base: number, streak: number): number`

```
bump = 15 * floor(streak / 2)      // 0,0,15,15,30,30,45,45,...
return base + min(bump, 45)        // plafon +45 dtk
```

- streak 0–1 → base
- streak 2–3 → base + 15
- streak 4–5 → base + 30
- streak ≥ 6 → base + 45 (plafon)

### Pass overload di `generateSession`

Untuk tiap gerakan hasil `pickForDomain` (kecuali intensitas `recovery`,
yang mengabaikan durasi):

1. `streak = countCleanStreak(ex.id, workoutLogs)`.
2. **Cek swap** — bila `streak >= 6` **dan** `intensity === "full"` **dan**
   `ex.progressionId` non-null **dan** gerakan progresi ada di pool
   `exercises` **dan** lolos filter equipment (`ex.equipment.every(e =>
   allowedEquipment.has(e))`):
   - Ganti `ex` dengan gerakan progresi pada durasi **base progresi**
     (gerakan baru punya riwayat log sendiri; streak-nya mulai dari nol
     secara alami).
   - Catat pasangan (nama lama → nama progresi) untuk reasoning.
3. **Kalau tidak swap** — clone gerakan dengan durasi
   `progressedDuration(ex.durationSeconds, streak)`. Bila durasi berubah,
   tandai "ada bump".
4. Emit gerakan hasil transform. Seed tidak pernah dimutasi (selalu clone
   via `{...ex, durationSeconds}`).

Transform diterapkan **sebelum** loop fit-budget, sehingga durasi yang lebih
panjang (atau gerakan progresi) tetap dihitung terhadap `availableMinutes`.

### Reasoning lines (Bahasa Indonesia)

- Bila ada minimal satu bump durasi (tanpa swap):
  `"Sebagian gerakan naik durasi — kamu konsisten menyelesaikannya."`
- Untuk tiap swap yang terjadi:
  `"<X> → <Progresi>: sudah mantap, naik ke variasi lebih menantang."`

## Edge cases

- Gerakan belum pernah dilog → streak 0 → durasi base, tanpa perubahan.
- Target progresi hilang dari pool atau ter-gate equipment → batal swap,
  pertahankan gerakan lama di durasi plafon.
- Intensitas `recovery` → tanpa overload (durasi diabaikan di jalur ini).
- Swap hanya terjadi di `full`; pada `light`/`moderate` gerakan tetap
  mendapat bump durasi (menambah hold pada gerakan aman itu aman), tapi
  tidak pernah swap.
- Setback (nyeri tinggi / tak selesai) menurunkan floor global via
  `deriveCapability`; gerakan progresi yang sudah ter-swap bisa jatuh keluar
  window kesulitan secara alami. Tidak ada penanganan regresi tambahan.

## Rencana test (TDD, urut RED→GREEN)

`countCleanStreak`:
- run bersih beruntun → menghitung benar.
- sesi absen di tengah → dilewati, streak lanjut.
- sesi hadir-tak-selesai → memutus.
- sesi hadir dengan `postSessionPain > 3` → memutus.
- gerakan tak pernah dilog → 0.

`progressedDuration`:
- step di 2/4/6; plafon di ≥6.

`generateSession` (integrasi):
- 2 log full bersih gerakan X → durasi X = base + 15.
- 6 log bersih → durasi X di plafon (base + 45).
- plafon + `full` + progresi tersedia → gerakan di-swap ke progresi.
- plafon + `moderate` → **tidak** swap (tetap durasi plafon).
- plafon + `full` + progresi ter-gate equipment → **tidak** swap.
- reasoning line muncul saat bump dan saat swap.

## Yang BUKAN scope M9

- Rep counting (sesi berbasis durasi).
- Regresi per-gerakan (ditangani floor global).
- Periodisasi (deload → M13).
- Field skema atau store baru.
