# M11-B — Library Expansion +12 (Design Spec)

Disusun 2026-07-13. Sumber: docs/11_Roadmap_M9-M14.md §M11. Bergantung pada
M11-A (fix tag equipment) yang sudah lebih dulu — supaya equipment baru
tampil benar di kartu.

## Tujuan

Tambah 12 gerakan terkurasi (36 → 48), menutup kategori prioritas roadmap:
aktivasi, scapular control, dip progression (equipment-gated), unilateral.
Bodyweight-first, aman, umum — bukan preskripsi kurva.

## Distribusi (3/3/3/3)

| Kategori | Jml | Domain skema | sideEmphasis | Equipment |
|----------|-----|--------------|--------------|-----------|
| Aktivasi | 3 | `stability` / `core` | `bilateral` | — (bodyweight) |
| Scapular control | 3 | `stability` | `bilateral` | — (bodyweight) |
| Dip progression | 3 | `strength` | `bilateral` | `"dip bars"` (gated) |
| Unilateral | 3 | `balance` / `strength` | pasangan `left`+`right` | — (bodyweight) |

Catatan: kategori "unilateral" secara alami butuh pasangan kiri/kanan. Untuk
menjaga total tepat 12 dan konsisten dengan pola seed yang ada (gerakan
unilateral diseed berpasangan L/R), 3 "slot" unilateral diisi sebagai
gerakan berpasangan `sideEmphasis: "left"`/`"right"`. Jumlah objek final
ditetapkan di plan; target badge kategori tetap terpenuhi. Balancing L/R
bersifat GENERIK (docs/04) — bukan menargetkan sisi kurva.

## Rantai progresi/regresi

- Tiap gerakan baru menyambung ke rantai yang koheren: dip progression
  membentuk rantai bertingkat (support → negative → full) via
  `progressionId`/`regressionId`; aktivasi & scapular membentuk rantai
  beginner→intermediate; unilateral menautkan varian lebih mudah→sulit.
- Boleh menaut ke gerakan seed yang sudah ada HANYA bila domain & pola
  gerak cocok; kalau ragu, rantai berdiri sendiri di antara gerakan baru.
- Semua `progressionId`/`regressionId` harus resolvable (id ada di seed) —
  dijaga oleh tes integrity yang sudah ada.

## Equipment baru: `"dip bars"`

Dip progression di-*gate* dengan string equipment baru `"dip bars"`.
Ditambahkan ke:

1. `equipment` pada 3 gerakan dip di seed.
2. `EQUIPMENT` list di `src/app/settings/page.tsx` (value `"dip bars"`,
   label `"Dip bars"`, desc singkat) supaya bisa dicentang pemilik.
3. Set `known` di tes integrity `EXERCISE_SEED` (`src/lib/__tests__/
   decision-engine.test.ts`) → `new Set(["pull-up bar", "dip bars"])`.

## Metadata tiap gerakan (wajib, per `exerciseSchema`)

`id` (unik, prefix `ex-`), `name`, `domain`, `difficulty`,
`durationSeconds` (positif), `equipment`, `sideEmphasis`, `cues[]` (Bahasa
Indonesia, ringkas), `contraindications[]` (konservatif, plain-language),
`progressionId`, `regressionId`, `videoUrl: null`.

## Guardrail konten (docs/04)

- Bodyweight-first; hanya 3 dip yang gated.
- Gerakan umum & aman; TIDAK menargetkan kurva atau sisi spesifik untuk
  koreksi; unilateral hanya untuk simetri/balancing generik.
- Tidak menjanjikan reduksi Cobb; tidak mendiagnosis.
- Kontraindikasi konservatif (mis. nyeri akut, gejala neurologis → skip).

## Testing

Perluas tes yang ada di `src/lib/__tests__/decision-engine.test.ts`:

- Integrity: `EXERCISE_SEED` tetap lolos `exerciseSchema`; id unik; semua
  `progressionId`/`regressionId` resolvable; `known` equipment mencakup
  `"dip bars"`; jumlah entri = 48.
- Gating: `pickForDomain` untuk `strength` TANPA `"dip bars"` di
  `allowedEquipment` tidak pernah mengembalikan gerakan dip; DENGAN
  `"dip bars"` dip menjadi eligible.
- Domain counts tidak turun: strength ≥ 5 (sudah ada) tetap lolos.

## Bukan scope

- Field skema baru (mis. `muscles[]` — itu M14).
- Retag otomatis library lama; hanya tambah + equipment `"dip bars"`.
- Video URL nyata (tetap `null`).
