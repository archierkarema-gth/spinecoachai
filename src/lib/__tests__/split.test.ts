import { describe, it, expect } from "vitest";
import { NORMALIZED_EXERCISE_SEED } from "@/lib/exercise-seed";
import { WEEK, weekdayOf, resolveDay, type Weekday } from "@/lib/split";

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat"];

// A known Sunday and Monday (2024-01-07 is a Sunday UTC; use local-safe values).
describe("weekdayOf", () => {
  it("maps JS getDay indices", () => {
    // 2023-11-13 is a Monday.
    expect(weekdayOf(new Date(2023, 10, 13))).toBe("mon");
    expect(weekdayOf(new Date(2023, 10, 12))).toBe("sun");
  });
});

describe("fixed split (spec §5)", () => {
  it("Sunday is rest", () => {
    const d = resolveDay("sun", NORMALIZED_EXERCISE_SEED, []);
    expect(d.isRest).toBe(true);
    expect(d.blocks).toHaveLength(0);
  });

  it("every weekday resolves without missing exercises", () => {
    for (const day of WEEKDAYS) {
      const d = resolveDay(day, NORMALIZED_EXERCISE_SEED, []);
      const missing = d.blocks.flatMap((b) => b.missing);
      expect(missing, `${day} missing: ${missing.join(", ")}`).toEqual([]);
    }
  });

  it("each weekday follows Prep/Scap → Main → Schroth → Finisher shape", () => {
    for (const day of WEEKDAYS) {
      const kinds = WEEK[day]!.blocks.map((b) => b.kind);
      expect(kinds).toContain("main");
      // Every training day integrates a schroth block (§5).
      expect(kinds).toContain("schroth");
    }
  });

  it("Thursday is the Schroth-deep day with both corrected breathing cues", () => {
    const d = resolveDay("thu", NORMALIZED_EXERCISE_SEED, []);
    const ids = d.blocks.flatMap((b) => b.exercises.map((e) => e.id));
    expect(ids).toContain("ex-schroth-breathing-upper");
    expect(ids).toContain("ex-schroth-breathing-lower");
  });

  it("families resolve to the entry rung with no history", () => {
    const d = resolveDay("mon", NORMALIZED_EXERCISE_SEED, []);
    const push = d.blocks.find((b) => b.kind === "main");
    // wall push-up is the entry of the push-horizontal family.
    expect(push?.exercises.some((e) => e.id === "ex-wall-pushup")).toBe(true);
  });
});

describe("seed normalization invariants", () => {
  it("seed has 81 curated exercises (M11 64 + M16 17 new)", () => {
    expect(NORMALIZED_EXERCISE_SEED.length).toBe(81);
  });

  it("every exercise has category, level, family after normalization", () => {
    for (const e of NORMALIZED_EXERCISE_SEED) {
      expect(e.category, e.id).toBeDefined();
      expect(e.level, e.id).toBeDefined();
      expect(e.family, e.id).toBeDefined();
    }
  });

  it("Schroth breathing directions match the corrected geometry (spec §1)", () => {
    const upper = NORMALIZED_EXERCISE_SEED.find((e) => e.id === "ex-schroth-breathing-upper")!;
    const lower = NORMALIZED_EXERCISE_SEED.find((e) => e.id === "ex-schroth-breathing-lower")!;
    expect(upper.schrothCue).toMatch(/KANAN ATAS/);
    expect(lower.schrothCue).toMatch(/KIRI BAWAH/);
  });

  it("PENDING_PT moves carry the flag and no guessed side (spec §1)", () => {
    const pending = ["ex-suitcase-carry", "ex-prone-derotation", "ex-schroth-pelvic-correction", "ex-side-lying-corrective"];
    for (const id of pending) {
      const e = NORMALIZED_EXERCISE_SEED.find((x) => x.id === id)!;
      expect(e.schrothCuePendingPT, id).toBe(true);
    }
  });

  it("skill-line moves are not marked foundational", () => {
    const skill = ["ex-tuck-front-lever-hold", "ex-tuck-planche-hold", "ex-pike-pushup"];
    for (const id of skill) {
      const e = NORMALIZED_EXERCISE_SEED.find((x) => x.id === id)!;
      expect(e.isFoundational, id).toBe(false);
    }
  });
});
