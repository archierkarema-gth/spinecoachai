# Roadmap — M9 sampai M14

Disusun 2026-07-12 dari SpineCoach_AI_Improvement_Proposal.md, disaring
terhadap Clinical Guardrails (docs/04) dan arsitektur engine (docs/05).

Prinsip yang tidak berubah di semua milestone:

- Engine tetap murni, deterministik, tanpa network/model.
- Tidak pernah menargetkan kurva spesifik, tidak pernah mengestimasi Cobb.
- Safety/recovery selalu menang atas performa; korektif tidak pernah nol.
- Field baru di skema selalu optional + default (tanpa migrasi IndexedDB).

Yang **ditolak** dari proposal (tidak masuk roadmap):

- ~~❌ Profil biomekanik kurva (thoracicCurve, lumbarCurve, curveDirection,
  severity) — melanggar guardrail "never targets a specific curve".~~
  **Dicabut 2026-07-20** oleh keputusan eksplisit owner — lihat addendum di
  `docs/04_Clinical_Guardrails.md` dan `clinicalProfile` di
  `src/lib/schemas.ts`. Guardrail lain (never diagnose / never promise Cobb
  reduction / never replace physician) TIDAK berubah.
- ❌ Library 250–400 gerakan — inflasi; kurasi kontraindikasi tidak
  terkelola. Target realistis: 60–80 gerakan terkurasi (masuk M11).
- ❌ AI Coach berbasis LLM — bentrok arsitektur inti (no network, no
  model). Reasoning berbahasa Indonesia sudah menjelaskan sesi.
- ❌ Periodisasi 6-minggu kaku — bentrok filosofi reaktif-harian; diganti
  deload berkala (M13). Progresi lanjutan (front lever/planche/archer
  pull-up dst, 2026-07-20) tetap lewat mekanisme streak-gated M9 per-gerakan,
  bukan blok bulan kaku — lihat `ex-commando-pullup` dst di
  `src/lib/exercise-seed.ts`.

---

## M9 — Progressive Overload Engine  _(Proposal P2 — prioritas tertinggi)_

Gap nyata: `progressionId`/`regressionId` sudah ada di seed tapi hanya
dipakai sebagai teks saran. Engine belum mendorong adaptasi jangka panjang.

Scope:

- Progresi durasi/hold per gerakan: kalau gerakan yang sama selesai bersih
  N sesi berturut-turut (tanpa lonjakan nyeri), naikkan durasi bertahap
  sampai plafon, lalu tawarkan `progressionId`-nya.
- Regresi otomatis: nyeri pasca-sesi tinggi atau gerakan tidak selesai →
  turunkan durasi atau tawarkan `regressionId`.
- Riwayat progresi per gerakan diderivasi dari `workoutLogs` yang sudah ada
  (tanpa store baru), konsisten dengan pendekatan capability floor M8.
- Reasoning line saat progresi/regresi terjadi.

Bukan scope: rep counting (sesi berbasis durasi), periodisasi.

## M10 — Recovery Load Input  _(Proposal P4 — pelengkap kecil)_

`decideIntensity` sudah memetakan pain/sleep/energy/recovery → 4 tier
(recovery/light/moderate/full) — sebagian besar P4 sudah terbangun.

Scope:

- Tambah *previous workout load* sebagai sinyal: volume sesi kemarin
  (total detik × intensitas) menekan intensitas hari ini kalau beban
  kemarin berat dan pemulihan pas-pasan.
- Tetap deterministik; ceiling keselamatan tidak berubah.

## M11 — Library Expansion Terkurasi  _(Proposal P7, versi waras)_

Scope:

- 36 → 60–80 gerakan bodyweight-first, tiap gerakan lengkap dengan cues,
  kontraindikasi, progression/regression link, dan equipment gating.
- Prioritas kategori dari proposal yang belum terwakili: aktivasi,
  scapular control, dip progression (gated equipment), unilateral.
- Perbaiki tag equipment di kartu workout (bug "Bodyweight" pada gerakan
  pull-up — sudah ter-flag).

## M12 — Objective Progress Dashboard  _(Proposal P6)_

Scope:

- Tes fungsional yang bisa diukur sendiri tanpa klaim klinis: plank max,
  push-up max, pull-up/dead-hang max, konsistensi mingguan.
- Grafik tren dari data log yang sudah ada + entri tes berkala.
- TIDAK ada "posture score" / "pelvic symmetry" sebagai angka klinis —
  kalau mau, hanya self-report kualitatif.

## M13 — Weekly Reassessment + Deload Berkala  _(Proposal P5 + P8-lite)_

Scope:

- Form re-assessment mingguan ringan (fleksibilitas, keseimbangan,
  kualitas napas, pain map self-report) → engine re-derive otomatis
  (goal weights + capability).
- Deload berkala: sesudah N minggu beban konsisten, satu minggu volume
  diturunkan otomatis — pengganti periodisasi kaku yang selaras dengan
  filosofi reaktif-harian.

## M14 — Preferensi Otot & Napas  _(Proposal P1-subset + P3-lite)_

Scope:

- `weakMuscles[]`, `tightMuscles[]`, `breathingPattern` sebagai preferensi
  profil (bukan data klinis kurva) → bias pemilihan gerakan.
- Perlu field `muscles[]` di skema exercise + retag library (setelah M11
  supaya sekali kerja).
- Volume mingguan per domain sebagai sinyal keseimbangan (P3-lite),
  bukan tracking per-otot penuh.

---

## Urutan & alasan

| Urutan | Milestone | Kenapa duluan |
|--------|-----------|---------------|
| 1 | M9 | Dampak terbesar; pakai infrastruktur yang sudah ada (links + logs) |
| 2 | M10 | Kecil, melengkapi loop M9 (load → recovery → intensity) |
| 3 | M11 | M12/M14 lebih berguna dengan pool gerakan lebih kaya |
| 4 | M12 | Butuh data progresi M9 supaya tren bermakna |
| 5 | M13 | Re-derive paling bernilai setelah ada metrik objektif |
| 6 | M14 | Butuh retag library (M11) dulu |

Setiap milestone dikerjakan dengan alur yang sama: brainstorm → design
spec → implementation plan → subagent-driven TDD → verifikasi browser →
merge.

---

## M15 — PWA Install Prompt + Daily Reminder _(selesai 2026-07-21)_

Scope: banner reminder check-in harian di Dashboard (local-only, muncul
setelah jam 16:00 kalau belum check-in hari itu, dismiss per-hari via
localStorage), dan banner custom "Tambah ke Layar Utama" (`beforeinstallprompt`,
cooldown dismiss 14 hari). Tidak ada web push/VAPID — di luar scope app
personal tanpa backend. Tidak ada perubahan skema/DB.

Spec: `docs/superpowers/specs/2026-07-21-m15-pwa-reminder-install-design.md`.
Plan: `docs/superpowers/plans/2026-07-21-m15-pwa-reminder-install.md`.

Catatan implementasi: `bottom-16` (Tailwind numeric spacing utility) tidak
pernah ter-generate oleh JIT scanner di repo ini — diganti arbitrary value
`bottom-[4rem]`. Juga ditemukan bug pre-existing (bukan dari M15): `Card`
component (`src/components/ui/card.tsx`) tidak punya base class `flex`,
jadi varian `className="flex-row ..."` di beberapa tempat (kartu Schroth
Dashboard, halaman Schroth) render `display:block` bukan row — dicatat
sebagai follow-up terpisah, bukan diperbaiki di milestone ini.
