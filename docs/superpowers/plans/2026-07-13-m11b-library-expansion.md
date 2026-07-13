# M11-B Library Expansion +12 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah 12 gerakan terkurasi ke `EXERCISE_SEED` (36 → 48) menutup kategori aktivasi, scapular control, dip progression (gated), dan unilateral — bodyweight-first, aman, umum.

**Architecture:** 12 objek `Exercise` baru disisipkan ke `src/lib/exercise-seed.ts` sebagai empat rantai terkunci-domain (masing-masing `progressionId`/`regressionId` menyambung DI DALAM satu domain, seperti rantai push-up/pull-up yang ada). Equipment baru `"dip bars"` men-*gate* rantai dip; ditambahkan ke settings + set `known` tes integrity. Tanpa perubahan skema.

**Tech Stack:** TypeScript, Vitest. Tanpa dependency baru.

## Global Constraints

- Bodyweight-first; hanya 3 gerakan dip yang gated dengan `"dip bars"`.
- Rantai progresi/regresi HARUS dalam satu domain (engine M9 swap menaruh gerakan progresi di blok domain yang sama).
- Semua `progressionId`/`regressionId` resolvable (id ada di seed).
- TIDAK menargetkan kurva/sisi spesifik; balancing generik saja (docs/04). Tidak menjanjikan reduksi Cobb.
- Tiap objek lolos `exerciseSchema`: `durationSeconds` positif, semua field ada, `videoUrl: null`.
- `id` unik, prefix `ex-`.
- Total akhir = 48; strength tetap ≥ 5.

## Peta gerakan baru (4 rantai, 12 objek)

- **Aktivasi** (domain `stability`, bilateral): `ex-clamshell-raise` → `ex-glute-bridge-march` → `ex-standing-hip-hinge`.
- **Scapular control** (domain `stability`, bilateral): `ex-scapular-wall-slide` → `ex-prone-t-raise` → `ex-scapular-pushup`.
- **Dip progression** (domain `strength`, gated `"dip bars"`): `ex-dip-support-hold` → `ex-negative-dip` → `ex-full-dip`.
- **Unilateral** (domain `balance`, bilateral/alternating — pola sama seperti `ex-single-leg-*` yang ada): `ex-tandem-stance` → `ex-single-leg-rdl` → `ex-single-leg-squat-box`.

---

### Task 1: Sisipkan 12 gerakan + perbarui tes integrity

**Files:**
- Modify: `src/lib/exercise-seed.ts` (sisipkan sebelum penutup `];` di akhir array, setelah entri `ex-full-pullup`)
- Test: `src/lib/__tests__/decision-engine.test.ts` (blok `describe("EXERCISE_SEED integrity")` yang ada)

**Interfaces:**
- Produces: 12 `Exercise` baru di `EXERCISE_SEED`; total panjang array = 48.

- [ ] **Step 1: Perbarui tes integrity dulu (gagal)**

Di `src/lib/__tests__/decision-engine.test.ts`, di dalam `describe("EXERCISE_SEED integrity")`, tambah tes jumlah dan perbarui set `known` equipment. Tambahkan tes:

```ts
  it("has grown to 48 curated exercises", () => {
    expect(EXERCISE_SEED.length).toBe(48);
  });
```

Dan ubah tes equipment yang ada dari:

```ts
    const known = new Set(["pull-up bar"]);
```

menjadi:

```ts
    const known = new Set(["pull-up bar", "dip bars"]);
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "EXERCISE_SEED integrity"`
Expected: FAIL — length 36 ≠ 48.

- [ ] **Step 3: Sisipkan 12 gerakan**

Di `src/lib/exercise-seed.ts`, tepat sebelum baris penutup array (`];` setelah objek `ex-full-pullup` yang berakhir di `regressionId: "ex-negative-pullup"`), sisipkan:

```ts
  // M11 — Activation chain (stability domain, bilateral, bodyweight).
  {
    id: "ex-clamshell-raise",
    name: "Clamshell Raise",
    domain: "stability",
    difficulty: "beginner",
    durationSeconds: 45,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Berbaring miring, lutut ditekuk", "Buka lutut atas seperti kerang, panggul diam"],
    contraindications: ["Nyeri pinggul tajam"],
    progressionId: "ex-glute-bridge-march",
    regressionId: null,
    videoUrl: null,
  },
  {
    id: "ex-glute-bridge-march",
    name: "Glute Bridge March",
    domain: "stability",
    difficulty: "beginner",
    durationSeconds: 50,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Panggul terangkat stabil", "Angkat satu kaki bergantian tanpa panggul goyang"],
    contraindications: ["Kram hamstring", "Nyeri pinggang saat mengangkat panggul"],
    progressionId: "ex-standing-hip-hinge",
    regressionId: "ex-clamshell-raise",
    videoUrl: null,
  },
  {
    id: "ex-standing-hip-hinge",
    name: "Standing Hip Hinge",
    domain: "stability",
    difficulty: "intermediate",
    durationSeconds: 50,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Dorong pinggul ke belakang, punggung netral", "Rasakan regang hamstring, kontrol naik-turun"],
    contraindications: ["Nyeri pinggang saat membungkuk", "Nyeri menjalar ke kaki"],
    progressionId: null,
    regressionId: "ex-glute-bridge-march",
    videoUrl: null,
  },
  // M11 — Scapular control chain (stability domain, bilateral, bodyweight).
  {
    id: "ex-scapular-wall-slide",
    name: "Scapular Wall Slide",
    domain: "stability",
    difficulty: "beginner",
    durationSeconds: 45,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Punggung & lengan nempel dinding", "Geser lengan naik-turun, belikat aktif"],
    contraindications: ["Nyeri bahu saat mengangkat lengan"],
    progressionId: "ex-prone-t-raise",
    regressionId: null,
    videoUrl: null,
  },
  {
    id: "ex-prone-t-raise",
    name: "Prone T Raise",
    domain: "stability",
    difficulty: "beginner",
    durationSeconds: 45,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Tengkurap, rentang lengan bentuk T", "Remas belikat, jempol ke atas"],
    contraindications: ["Nyeri bahu saat mengangkat", "Nyeri leher saat tengkurap"],
    progressionId: "ex-scapular-pushup",
    regressionId: "ex-scapular-wall-slide",
    videoUrl: null,
  },
  {
    id: "ex-scapular-pushup",
    name: "Scapular Push-up",
    domain: "stability",
    difficulty: "intermediate",
    durationSeconds: 40,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Posisi plank tinggi, siku tetap lurus", "Dorong-tarik belikat tanpa menekuk siku"],
    contraindications: ["Nyeri pergelangan tangan", "Nyeri bahu saat menumpu"],
    progressionId: null,
    regressionId: "ex-prone-t-raise",
    videoUrl: null,
  },
  // M11 — Dip progression chain (strength domain, gated by "dip bars").
  {
    id: "ex-dip-support-hold",
    name: "Dip Support Hold",
    domain: "strength",
    difficulty: "beginner",
    durationSeconds: 30,
    equipment: ["dip bars"],
    sideEmphasis: "bilateral",
    cues: ["Bertumpu lengan lurus di palang", "Bahu turun, badan tegak, tahan"],
    contraindications: ["Nyeri bahu saat menumpu", "Nyeri siku"],
    progressionId: "ex-negative-dip",
    regressionId: null,
    videoUrl: null,
  },
  {
    id: "ex-negative-dip",
    name: "Negative Dip",
    domain: "strength",
    difficulty: "intermediate",
    durationSeconds: 40,
    equipment: ["dip bars"],
    sideEmphasis: "bilateral",
    cues: ["Mulai dari atas, tekuk siku", "Turun perlahan 3–5 detik terkontrol"],
    contraindications: ["Nyeri bahu/siku saat menahan", "Nyeri dada tajam"],
    progressionId: "ex-full-dip",
    regressionId: "ex-dip-support-hold",
    videoUrl: null,
  },
  {
    id: "ex-full-dip",
    name: "Full Dip",
    domain: "strength",
    difficulty: "advanced",
    durationSeconds: 45,
    equipment: ["dip bars"],
    sideEmphasis: "bilateral",
    cues: ["Turun sampai siku sekitar 90°", "Dorong naik penuh terkontrol"],
    contraindications: ["Nyeri bahu/siku saat menekan", "Bahu tidak stabil"],
    progressionId: null,
    regressionId: "ex-negative-dip",
    videoUrl: null,
  },
  // M11 — Unilateral balance chain (balance domain, bilateral/alternating, bodyweight).
  {
    id: "ex-tandem-stance",
    name: "Tandem Stance",
    domain: "balance",
    difficulty: "beginner",
    durationSeconds: 60,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Kaki lurus tumit-jari, satu garis", "Fokus pandangan, tahan seimbang, ganti sisi"],
    contraindications: ["Vertigo", "Riwayat jatuh tanpa pegangan"],
    progressionId: "ex-single-leg-rdl",
    regressionId: null,
    videoUrl: null,
  },
  {
    id: "ex-single-leg-rdl",
    name: "Single-Leg RDL",
    domain: "balance",
    difficulty: "intermediate",
    durationSeconds: 60,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Berdiri satu kaki, condong dari pinggul", "Punggung netral, ganti sisi tiap set"],
    contraindications: ["Nyeri pinggang saat membungkuk", "Keseimbangan buruk tanpa pegangan"],
    progressionId: "ex-single-leg-squat-box",
    regressionId: "ex-tandem-stance",
    videoUrl: null,
  },
  {
    id: "ex-single-leg-squat-box",
    name: "Single-Leg Squat ke Kursi",
    domain: "balance",
    difficulty: "advanced",
    durationSeconds: 60,
    equipment: [],
    sideEmphasis: "bilateral",
    cues: ["Turun satu kaki ke kursi terkontrol", "Bangkit tanpa dorong tangan, ganti sisi"],
    contraindications: ["Nyeri lutut menekuk beban", "Keseimbangan buruk tanpa pegangan"],
    progressionId: null,
    regressionId: "ex-single-leg-rdl",
    videoUrl: null,
  },
```

- [ ] **Step 4: Jalankan tes integrity, pastikan lulus**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "EXERCISE_SEED integrity"`
Expected: PASS — length 48, semua id unik, semua link progresi/regresi resolvable, semua entri lolos schema, equipment `"dip bars"` dikenal.

- [ ] **Step 5: Jalankan seluruh suite + typecheck**

Run: `npx vitest run` lalu `npx tsc --noEmit`
Expected: semua lulus, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/exercise-seed.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: add 12 curated exercises across 4 domain chains (M11-B)"
```

---

### Task 2: Gate dip via settings + tes gating

**Files:**
- Modify: `src/app/settings/page.tsx` (konstanta `EQUIPMENT`, sekitar baris 26-35)
- Test: `src/lib/__tests__/decision-engine.test.ts` (tambah `describe` gating)

**Interfaces:**
- Consumes: `pickForDomain` (sudah ada), `EXERCISE_SEED` (48 entri dari Task 1).

- [ ] **Step 1: Tulis tes gating yang gagal**

Tambah di akhir `src/lib/__tests__/decision-engine.test.ts`:

```ts
describe("M11 dip equipment gating", () => {
  const R = { beginner: 0, intermediate: 1, advanced: 2 };

  it("excludes dip moves from strength when dip bars not owned", () => {
    const picks = pickForDomain(
      EXERCISE_SEED,
      "strength",
      R.beginner,
      R.advanced,
      20,
      { allowedEquipment: new Set<string>() }
    );
    expect(picks.some((e) => e.id.startsWith("ex-dip") || e.id === "ex-negative-dip" || e.id === "ex-full-dip")).toBe(false);
  });

  it("includes dip moves when dip bars owned", () => {
    const picks = pickForDomain(
      EXERCISE_SEED,
      "strength",
      R.beginner,
      R.advanced,
      20,
      { allowedEquipment: new Set(["dip bars"]) }
    );
    expect(picks.some((e) => e.equipment.includes("dip bars"))).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan tes, cek status**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "dip equipment gating"`
Expected: Tes pertama (exclude) sudah PASS otomatis (pickForDomain sudah memfilter equipment; dip butuh `"dip bars"`). Tes kedua (include) juga PASS. Kalau keduanya sudah hijau setelah Task 1, ini mengunci perilaku — lanjut. (Tidak masalah bila tidak "merah dulu": ini regression guard untuk gating equipment yang sudah ada, diperluas ke equipment baru.)

- [ ] **Step 3: Tambah "dip bars" ke settings EQUIPMENT**

Di `src/app/settings/page.tsx`, di dalam array `EQUIPMENT` (setelah entri `"pull-up bar"`), tambah entri:

```ts
  {
    value: "dip bars",
    label: "Dip bars",
    desc: "Palang dip / parallettes untuk progresi dip.",
  },
```

(Samakan bentuk objek dengan entri `"pull-up bar"` yang sudah ada: field `value`, `label`, `desc`.)

- [ ] **Step 4: Typecheck + suite penuh**

Run: `npx tsc --noEmit` lalu `npx vitest run`
Expected: exit 0, semua tes lulus.

- [ ] **Step 5: Verifikasi browser (opsional bila server hidup)**

Di `/settings`, konfirmasi opsi "Dip bars" muncul dan bisa dicentang. Di `/workout` dengan "dip bars" dimiliki + user cukup kuat, gerakan dip bisa muncul dengan badge "Dip bars" (dari M11-A). Cukup screenshot settings sebagai bukti; kalau server tidak hidup, andalkan tes.

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/page.tsx src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: gate dip progression behind dip bars equipment (M11-B)"
```

---

## Self-Review

- **Spec coverage:** 12 gerakan 4 kategori (Task 1); rantai terkunci-domain (Task 1 objek); equipment `"dip bars"` di seed + settings + known set (Task 1 & 2); tes integrity count 48/link resolvable/known equipment (Task 1); tes gating dip (Task 2); strength ≥5 tetap (17, dijaga tes ≥5 yang ada). Semua tercakup.
- **Placeholder scan:** tidak ada TBD/TODO; semua objek & tes kode lengkap.
- **Type consistency:** tiap objek punya semua field `exerciseSchema` (`id,name,domain,difficulty,durationSeconds,equipment,sideEmphasis,cues,contraindications,progressionId,regressionId,videoUrl`); id yang direferensikan `progressionId`/`regressionId` semuanya didefinisikan dalam blok yang sama; `"dip bars"` dipakai identik di seed, settings, dan set `known`.
- **Guardrail:** semua gerakan umum/aman, tanpa targeting kurva; kontraindikasi konservatif; `videoUrl: null`.
