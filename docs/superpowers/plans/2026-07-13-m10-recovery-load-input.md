# M10 Recovery Load Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beban workout 48 jam terakhir yang berat + pemulihan pas-pasan menurunkan intensitas sesi hari ini satu tier, deterministik.

**Architecture:** `decideIntensity(checkIn)` tetap murni. Dua fungsi baru di `src/lib/decision-engine.ts` — `recentLoad(logs, now)` menghitung beban berbobot 48 jam, dan `applyLoadSuppression(base, checkIn, logs, now)` menurunkan satu tier bila syarat terpenuhi. `generateSession` memanggil `applyLoadSuppression` tepat setelah `decideIntensity` dan menambah baris reasoning saat tier berubah.

**Tech Stack:** TypeScript, Vitest. Tanpa dependency baru.

## Global Constraints

- Engine murni, deterministik, tanpa network/model.
- Tidak menargetkan kurva, tidak mengestimasi Cobb.
- Safety/recovery menang: base `recovery` tidak pernah disentuh langkah ini.
- Tanpa field skema baru, tanpa store baru — pakai `workoutLogs` yang ada.
- `WorkoutLog.intensity` bertipe `string` (bukan enum): lookup bobot harus punya fallback.
- Ceiling keselamatan tidak berubah.

---

### Task 1: Fungsi murni `recentLoad` + `applyLoadSuppression`

**Files:**
- Modify: `src/lib/decision-engine.ts` (tambah konstanta + dua fungsi export, dekat `decideIntensity` di sekitar baris 226-240)
- Test: `src/lib/__tests__/decision-engine.test.ts` (tambah dua `describe` baru di akhir file)

**Interfaces:**
- Consumes: `SessionIntensity` (sudah ada, baris 22), `CheckIn` (`@/lib/exercise-schemas`), `WorkoutLog` (`@/lib/log-schemas`, punya `createdAt: number`, `intensity: string`, `estimatedMinutes: number`).
- Produces:
  - `INTENSITY_WEIGHT: Record<string, number>` (konstanta modul, tidak diekspor)
  - `HEAVY_LOAD_THRESHOLD = 45` (konstanta modul, tidak diekspor)
  - `recentLoad(workoutLogs: WorkoutLog[], now: number): number`
  - `applyLoadSuppression(base: SessionIntensity, checkIn: CheckIn, workoutLogs: WorkoutLog[], now: number): SessionIntensity`

- [ ] **Step 1: Tulis tes yang gagal**

Tambah di akhir `src/lib/__tests__/decision-engine.test.ts`. Helper `wlog` yang ada TIDAK mengeset `createdAt`/`intensity`/`estimatedMinutes` sesuai kebutuhan (default `createdAt: 0`, `intensity: "full"`, `estimatedMinutes: 10`), jadi buat log inline. Impor `recentLoad` dan `applyLoadSuppression` di blok import teratas (`from "@/lib/decision-engine"`).

```ts
describe("recentLoad", () => {
  const H = 60 * 60 * 1000;
  function log(overrides: Partial<WorkoutLog>): WorkoutLog {
    return {
      id: "l1",
      userId: "u1",
      createdAt: 0,
      movementFocus: "x",
      intensity: "full",
      estimatedMinutes: 30,
      exercises: [],
      ...overrides,
    };
  }

  it("sums minutes weighted by intensity within 48h", () => {
    const now = 100 * H;
    // full 30m (weight 1.0 = 30) + light 30m (weight 0.5 = 15) = 45
    const logs = [
      log({ createdAt: now - 2 * H, intensity: "full", estimatedMinutes: 30 }),
      log({ createdAt: now - 10 * H, intensity: "light", estimatedMinutes: 30 }),
    ];
    expect(recentLoad(logs, now)).toBe(45);
  });

  it("excludes logs at or beyond 48h", () => {
    const now = 100 * H;
    const logs = [log({ createdAt: now - 49 * H, intensity: "full", estimatedMinutes: 30 })];
    expect(recentLoad(logs, now)).toBe(0);
  });

  it("includes a log at 47h", () => {
    const now = 100 * H;
    const logs = [log({ createdAt: now - 47 * H, intensity: "full", estimatedMinutes: 30 })];
    expect(recentLoad(logs, now)).toBe(30);
  });

  it("ignores future-dated logs", () => {
    const now = 100 * H;
    const logs = [log({ createdAt: now + 2 * H, intensity: "full", estimatedMinutes: 30 })];
    expect(recentLoad(logs, now)).toBe(0);
  });

  it("treats an unknown intensity string with the moderate fallback weight", () => {
    const now = 100 * H;
    const logs = [log({ createdAt: now - 1 * H, intensity: "weird", estimatedMinutes: 40 })];
    // fallback weight 0.75 → 40 * 0.75 = 30
    expect(recentLoad(logs, now)).toBe(30);
  });
});

describe("applyLoadSuppression", () => {
  const H = 60 * 60 * 1000;
  const now = 100 * H;
  function heavyLogs(): WorkoutLog[] {
    // two full 30m sessions in 48h → load 60 (>= 45)
    return [
      { id: "a", userId: "u1", createdAt: now - 2 * H, movementFocus: "x", intensity: "full", estimatedMinutes: 30, exercises: [] },
      { id: "b", userId: "u1", createdAt: now - 20 * H, movementFocus: "x", intensity: "full", estimatedMinutes: 30, exercises: [] },
    ];
  }

  it("drops full to moderate when load heavy and recovery <= 3", () => {
    expect(applyLoadSuppression("full", checkIn({ recovery: 3 }), heavyLogs(), now)).toBe("moderate");
  });

  it("drops moderate to light when load heavy and recovery <= 3", () => {
    expect(applyLoadSuppression("moderate", checkIn({ recovery: 2 }), heavyLogs(), now)).toBe("light");
  });

  it("does not drop when recovery >= 4 even if load heavy", () => {
    expect(applyLoadSuppression("full", checkIn({ recovery: 4 }), heavyLogs(), now)).toBe("full");
  });

  it("does not drop when load is light", () => {
    const lightLogs: WorkoutLog[] = [
      { id: "a", userId: "u1", createdAt: now - 2 * H, movementFocus: "x", intensity: "light", estimatedMinutes: 20, exercises: [] },
    ];
    expect(applyLoadSuppression("full", checkIn({ recovery: 2 }), lightLogs, now)).toBe("full");
  });

  it("never touches base light or recovery", () => {
    expect(applyLoadSuppression("light", checkIn({ recovery: 2 }), heavyLogs(), now)).toBe("light");
    expect(applyLoadSuppression("recovery", checkIn({ recovery: 2 }), heavyLogs(), now)).toBe("recovery");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "recentLoad"`
Expected: FAIL — `recentLoad is not a function` / import error.

- [ ] **Step 3: Implementasi minimal**

Sisipkan di `src/lib/decision-engine.ts` tepat setelah fungsi `decideIntensity` (setelah baris 240):

```ts
/** Weight each logged session's minutes by how hard it was. */
const INTENSITY_WEIGHT: Record<string, number> = {
  recovery: 0.25,
  light: 0.5,
  moderate: 0.75,
  full: 1.0,
};
/** Unknown intensity strings fall back to the moderate weight. */
const FALLBACK_WEIGHT = 0.75;
/** Weighted-minute load over 48h that counts as "heavy" (~1.5 full sessions). */
const HEAVY_LOAD_THRESHOLD = 45;
const LOAD_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Weighted training load in the 48h before `now`: Σ minutes × intensity
 * weight. Future-dated logs and logs at/after the window edge are ignored.
 * Exported for unit testing.
 */
export function recentLoad(workoutLogs: WorkoutLog[], now: number): number {
  let load = 0;
  for (const log of workoutLogs) {
    const age = now - log.createdAt;
    if (age < 0 || age >= LOAD_WINDOW_MS) continue;
    const weight = INTENSITY_WEIGHT[log.intensity] ?? FALLBACK_WEIGHT;
    load += log.estimatedMinutes * weight;
  }
  return load;
}

/**
 * Ease today's intensity one tier when the last 48h were heavy AND recovery
 * is only marginal. Safety-first: base `recovery`/`light` are never lowered
 * (recovery is the pain/safety lane), and the drop is at most one tier.
 * Exported for unit testing.
 */
export function applyLoadSuppression(
  base: SessionIntensity,
  checkIn: CheckIn,
  workoutLogs: WorkoutLog[],
  now: number
): SessionIntensity {
  if (base !== "full" && base !== "moderate") return base;
  if (checkIn.recovery > 3) return base;
  if (recentLoad(workoutLogs, now) < HEAVY_LOAD_THRESHOLD) return base;
  return base === "full" ? "moderate" : "light";
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "recentLoad"` lalu `-t "applyLoadSuppression"`
Expected: PASS semua.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: add recentLoad + applyLoadSuppression helpers (M10)"
```

---

### Task 2: Integrasi ke `generateSession` + reasoning

**Files:**
- Modify: `src/lib/decision-engine.ts` (fungsi `generateSession`, sekitar baris 327-339 tempat `decideIntensity` dipanggil)
- Test: `src/lib/__tests__/decision-engine.test.ts` (tambah `describe` integrasi)

**Interfaces:**
- Consumes: `applyLoadSuppression` (Task 1), `decideIntensity`, `generateSession`, `inputs()` test helper (baris 52), `checkIn()` helper (baris 38).
- Produces: perilaku `generateSession` — intensitas final sudah dilewatkan `applyLoadSuppression`; saat tier turun karena beban, ada baris reasoning berisi teks `"Beban 2 hari terakhir"`.

- [ ] **Step 1: Tulis tes integrasi yang gagal**

Tambah di akhir `src/lib/__tests__/decision-engine.test.ts`:

```ts
describe("generateSession — M10 recovery load", () => {
  const H = 60 * 60 * 1000;
  const nowTs = 1_000_000; // checkIn().createdAt default
  function fullLog(ageH: number): WorkoutLog {
    return {
      id: `fl-${ageH}`,
      userId: "u1",
      createdAt: nowTs - ageH * H,
      movementFocus: "x",
      intensity: "full",
      estimatedMinutes: 30,
      exercises: [],
    };
  }

  it("eases intensity one tier and notes it when 48h load is heavy and recovery marginal", () => {
    // base would be "full" (high readiness) but recovery only 3 + heavy load
    const s = generateSession(
      inputs({
        checkIn: checkIn({ painLevel: 1, recovery: 3, energyLevel: 4, sleepQuality: 4 }),
        workoutLogs: [fullLog(2), fullLog(20)], // load 60 >= 45
      })
    );
    expect(s.intensity).toBe("moderate");
    expect(s.reasoning.some((r) => r.includes("Beban 2 hari terakhir"))).toBe(true);
  });

  it("does not ease or note when load is light", () => {
    const s = generateSession(
      inputs({
        checkIn: checkIn({ painLevel: 1, recovery: 4, energyLevel: 4, sleepQuality: 4 }),
        workoutLogs: [fullLog(2)], // load 30 < 45
      })
    );
    expect(s.intensity).toBe("full");
    expect(s.reasoning.some((r) => r.includes("Beban 2 hari terakhir"))).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "M10 recovery load"`
Expected: FAIL — intensity `full`, tidak `moderate` (suppression belum terpasang).

- [ ] **Step 3: Pasang suppression di `generateSession`**

Di `src/lib/decision-engine.ts`, ganti baris `const intensity = decideIntensity(checkIn);` (sekitar baris 328) dan blok reasoning setelahnya. Tambahkan pemanggilan suppression + baris reasoning:

```ts
  // 2. Recovery / readiness.
  const baseIntensity = decideIntensity(checkIn);
  const intensity = applyLoadSuppression(
    baseIntensity,
    checkIn,
    inputs.workoutLogs ?? [],
    checkIn.createdAt
  );
  if (intensity !== baseIntensity) {
    reasoning.push(
      "Beban 2 hari terakhir cukup berat & pemulihan pas-pasan — turunkan satu tingkat hari ini."
    );
  }
```

Blok `if (intensity === "recovery") { ... } else if ...` yang ada di bawahnya tetap dipakai apa adanya (sekarang membaca `intensity` hasil suppression).

- [ ] **Step 4: Jalankan tes M10, pastikan lulus**

Run: `npx vitest run src/lib/__tests__/decision-engine.test.ts -t "M10 recovery load"`
Expected: PASS.

- [ ] **Step 5: Jalankan seluruh suite + typecheck (cek regresi)**

Run: `npx vitest run` lalu `npx tsc --noEmit`
Expected: semua lulus, exit 0. (Perhatikan: sesi lama tanpa `workoutLogs` berat tidak berubah karena load 0.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/decision-engine.ts src/lib/__tests__/decision-engine.test.ts
git commit -m "feat: apply 48h load suppression to session intensity (M10)"
```

---

## Self-Review

- **Spec coverage:** metrik beban 48h + bobot (Task 1 recentLoad); ambang 45 (Task 1); aturan 1-tier + syarat recovery≤3 + base full/moderate (Task 1 applyLoadSuppression); reasoning line (Task 2); integrasi generateSession + `now` dari `checkIn.createdAt` (Task 2); jendela 48h & future-dated (Task 1 tests). Semua tercakup.
- **Placeholder scan:** tidak ada TBD/TODO; semua step berisi kode nyata.
- **Type consistency:** `recentLoad(WorkoutLog[], number): number` dan `applyLoadSuppression(SessionIntensity, CheckIn, WorkoutLog[], number): SessionIntensity` dipakai konsisten di Task 1 & 2. `checkIn.recovery > 3` = negasi `recovery ≤ 3`. Ambang `< HEAVY_LOAD_THRESHOLD` = negasi `≥ 45`.
