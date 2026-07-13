# M11-A — Equipment Tag Fix (Design Spec)

Disusun 2026-07-13. Sumber: docs/11_Roadmap_M9-M14.md §M11 ("Perbaiki tag
equipment di kartu workout — bug 'Bodyweight' pada gerakan pull-up").

## Masalah

`src/app/workout/page.tsx:210` meng-*hardcode* badge `"Bodyweight"` untuk
SETIAP gerakan di kartu sesi, mengabaikan `ex.equipment`. Gerakan
equipment-gated (mis. pull-up dengan `equipment: ["pull-up bar"]`) tetap
tampil "Bodyweight" — salah dan menyesatkan.

## Perilaku yang diinginkan

Untuk tiap gerakan di kartu sesi:

- `ex.equipment.length === 0` → satu badge `"Bodyweight"` (perilaku lama).
- `ex.equipment.length > 0` → satu badge per item equipment, dengan label
  ramah-tampilan (title case), mis. `["pull-up bar"]` → badge `"Pull-up bar"`.
  Tidak ada badge "Bodyweight" untuk gerakan ber-equipment.

Badge equipment memakai gaya yang sama dengan badge yang ada (kelas
`rounded-full ... text-success`), disusun setelah badge `sideEmphasis`.

## Pelabelan & logika badge (helper murni)

Repo belum punya infra tes komponen React (ada `jsdom` tapi tanpa
`@testing-library`). Untuk menghindari menambah dependency, ekstrak logika
badge ke fungsi murni yang bisa diuji, lalu JSX hanya me-*map* hasilnya.

Buat modul kecil `src/lib/equipment-label.ts`:

```ts
/** Title-case sebuah string equipment untuk ditampilkan. */
export function equipmentLabel(item: string): string;
/**
 * Daftar label badge equipment untuk sebuah gerakan:
 * ["Bodyweight"] kalau tanpa alat, selain itu label tiap equipment.
 */
export function equipmentBadges(equipment: string[]): string[];
```

- `equipmentLabel("pull-up bar")` → `"Pull-up bar"` (huruf pertama tiap kata
  besar, sisanya apa adanya).
- `equipmentBadges([])` → `["Bodyweight"]`.
- `equipmentBadges(["pull-up bar"])` → `["Pull-up bar"]`.
- `equipmentBadges(["dip bars"])` → `["Dip bars"]`.

## Arsitektur

Logika badge di helper murni `src/lib/equipment-label.ts`; kartu workout
(`src/app/workout/page.tsx`) memanggil `equipmentBadges(ex.equipment)` dan
me-*map* jadi satu `<span>` per label (gaya `rounded-full ... text-success`
yang sama, setelah badge `sideEmphasis`). Tanpa perubahan skema, engine,
store, atau dependency baru.

## Testing

Unit (Vitest, tanpa dependency baru) di
`src/lib/__tests__/equipment-label.test.ts`:

- `equipmentLabel`: `"pull-up bar"` → `"Pull-up bar"`; `"dip bars"` →
  `"Dip bars"`; `"band"` → `"Band"`.
- `equipmentBadges`: `[]` → `["Bodyweight"]`; `["pull-up bar"]` →
  `["Pull-up bar"]` (tidak mengandung "Bodyweight"); dua item →
  dua label.

## Bukan scope

- Menambah gerakan / equipment baru (itu M11-B).
- Mengubah gaya visual lain di kartu.
