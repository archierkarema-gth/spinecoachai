# M11-A Equipment Tag Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kartu sesi workout menampilkan badge equipment yang benar — "Bodyweight" hanya untuk gerakan tanpa alat, label equipment untuk gerakan ber-alat.

**Architecture:** Ekstrak logika badge ke helper murni `src/lib/equipment-label.ts` (`equipmentLabel`, `equipmentBadges`), uji dengan Vitest, lalu ganti badge hardcoded "Bodyweight" di `src/app/workout/page.tsx` dengan map atas `equipmentBadges(ex.equipment)`.

**Tech Stack:** TypeScript, React (Next.js), Vitest. Tanpa dependency baru.

## Global Constraints

- Perubahan presentasi murni; tanpa perubahan skema, engine, atau store.
- Tanpa dependency tes baru (repo belum punya @testing-library) — uji lewat helper murni.
- Gaya badge sama dengan yang ada: `rounded-full ... px-2 py-0.5 text-[11px] font-medium text-success`.
- Label = title-case: huruf pertama tiap kata besar, sisa karakter apa adanya.

---

### Task 1: Helper murni `equipment-label.ts`

**Files:**
- Create: `src/lib/equipment-label.ts`
- Test: `src/lib/__tests__/equipment-label.test.ts`

**Interfaces:**
- Produces:
  - `equipmentLabel(item: string): string`
  - `equipmentBadges(equipment: string[]): string[]`

- [ ] **Step 1: Tulis tes yang gagal**

Create `src/lib/__tests__/equipment-label.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { equipmentLabel, equipmentBadges } from "@/lib/equipment-label";

describe("equipmentLabel", () => {
  it("title-cases a multi-word equipment string", () => {
    expect(equipmentLabel("pull-up bar")).toBe("Pull-up bar");
    expect(equipmentLabel("dip bars")).toBe("Dip bars");
  });

  it("capitalizes a single word", () => {
    expect(equipmentLabel("band")).toBe("Band");
  });
});

describe("equipmentBadges", () => {
  it("returns Bodyweight for no equipment", () => {
    expect(equipmentBadges([])).toEqual(["Bodyweight"]);
  });

  it("labels each equipment item and omits Bodyweight", () => {
    expect(equipmentBadges(["pull-up bar"])).toEqual(["Pull-up bar"]);
    expect(equipmentBadges(["dip bars"])).not.toContain("Bodyweight");
  });

  it("labels multiple items", () => {
    expect(equipmentBadges(["pull-up bar", "dip bars"])).toEqual([
      "Pull-up bar",
      "Dip bars",
    ]);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run src/lib/__tests__/equipment-label.test.ts`
Expected: FAIL — module not found / not a function.

- [ ] **Step 3: Implementasi**

Create `src/lib/equipment-label.ts`:

```ts
/**
 * Display helpers for exercise equipment badges (docs/06). Title-cases raw
 * equipment strings and derives the badge list shown on a session card:
 * bodyweight moves (no equipment) get a single "Bodyweight" badge.
 */

/** Title-case an equipment string: first letter of each word uppercased. */
export function equipmentLabel(item: string): string {
  return item
    .split(" ")
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** Badge labels for a move: ["Bodyweight"] if no equipment, else each item. */
export function equipmentBadges(equipment: string[]): string[] {
  if (equipment.length === 0) return ["Bodyweight"];
  return equipment.map(equipmentLabel);
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run src/lib/__tests__/equipment-label.test.ts`
Expected: PASS (semua).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/equipment-label.ts src/lib/__tests__/equipment-label.test.ts
git commit -m "feat: add equipmentBadges/equipmentLabel helpers (M11-A)"
```

---

### Task 2: Pakai helper di kartu workout

**Files:**
- Modify: `src/app/workout/page.tsx` (import + badge block sekitar baris 205-212)

**Interfaces:**
- Consumes: `equipmentBadges` dari `src/lib/equipment-label.ts` (Task 1).

- [ ] **Step 1: Tambah import**

Di `src/app/workout/page.tsx`, setelah baris import `SessionPlayer`/tipe (sekitar baris 16-18), tambah:

```ts
import { equipmentBadges } from "@/lib/equipment-label";
```

- [ ] **Step 2: Ganti badge hardcoded**

Ganti blok ini (sekitar baris 205-212):

```tsx
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {SIDE_LABEL[ex.sideEmphasis]}
                    </span>
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                      Bodyweight
                    </span>
                  </div>
```

menjadi:

```tsx
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {SIDE_LABEL[ex.sideEmphasis]}
                    </span>
                    {equipmentBadges(ex.equipment).map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: exit 0.
Run: `npx next lint` (kalau ada skrip lint di repo; abaikan bila tidak).
Expected: tidak ada error baru.

- [ ] **Step 4: Verifikasi di browser**

Jalankan dev server (preview_start dengan config di .claude/launch.json; buat kalau belum ada: name "dev", runtimeExecutable "npm", runtimeArgs ["run","dev"], port 3000). Buka halaman `/workout`, hasilkan sesi. Konfirmasi:
- Gerakan bodyweight → badge "Bodyweight".
- Kalau ada gerakan ber-equipment yang muncul (mis. pull-up saat "pull-up bar" dimiliki di settings) → badge "Pull-up bar", bukan "Bodyweight".
Ambil screenshot sebagai bukti.

Catatan: kalau seed default tidak memunculkan gerakan ber-equipment tanpa setup, verifikasi cukup lewat tes helper Task 1 + inspeksi kode; screenshot bodyweight tetap membuktikan tidak ada regresi.

- [ ] **Step 5: Commit**

```bash
git add src/app/workout/page.tsx
git commit -m "fix: show real equipment badge on workout card, not hardcoded Bodyweight (M11-A)"
```

---

## Self-Review

- **Spec coverage:** helper `equipmentLabel` + `equipmentBadges` (Task 1); title-case & Bodyweight fallback (Task 1 tests); kartu memakai helper, satu span per label, gaya sama (Task 2); tanpa dependency baru (helper murni Vitest). Semua tercakup.
- **Placeholder scan:** tidak ada TBD/TODO; kode lengkap di tiap step.
- **Type consistency:** `equipmentBadges(equipment: string[]): string[]` dipakai konsisten di Task 1 & 2; `ex.equipment` bertipe `string[]` per `exerciseSchema`.
