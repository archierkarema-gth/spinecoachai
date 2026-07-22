import { describe, it, expect } from "vitest";
import { NORMALIZED_EXERCISE_SEED } from "@/lib/exercise-seed";
import { buildProgressionMap, buildSafetyStrip } from "@/lib/progression-view";
import type { AsymmetryLog } from "@/lib/log-schemas";
import type { User } from "@/lib/schemas";

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const user: User = {
  id: "u1",
  name: "T",
  age: 30,
  createdAt: NOW - 4 * 7 * DAY, // 4 weeks in
  trainingPreset: "balanced",
  ownedEquipment: ["pull-up bar", "dip bars"],
};

describe("buildProgressionMap", () => {
  it("includes only foundational families and never skill-lines", () => {
    const rows = buildProgressionMap(NORMALIZED_EXERCISE_SEED, [], user, NOW);
    expect(rows.length).toBeGreaterThan(0);
    const families = rows.map((r) => r.family);
    expect(families).not.toContain("front-lever");
    expect(families).not.toContain("planche");
    expect(families).toContain("hollow");
    expect(families).toContain("pallof");
  });

  it("starts each family at its entry rung; L1 families read behind at 4 weeks", () => {
    const rows = buildProgressionMap(NORMALIZED_EXERCISE_SEED, [], user, NOW);
    for (const r of rows) {
      expect(r.currentLevel).toBeGreaterThanOrEqual(1);
      expect(r.currentLevel).toBeLessThanOrEqual(4);
      // A family whose entry rung is L1 has gained nothing in 4 weeks → behind.
      if (r.currentLevel === 1) expect(r.projection.status).toBe("behind");
    }
  });

  it("locks a PT-gated next move when user not cleared", () => {
    // Craft a tiny library: L1 foundational → L2 requiresPTClearance.
    const lib = [
      {
        ...NORMALIZED_EXERCISE_SEED[0],
        id: "f1",
        family: "famX",
        isFoundational: true,
        level: 1 as const,
        progressionNextId: "f2",
      },
      {
        ...NORMALIZED_EXERCISE_SEED[0],
        id: "f2",
        family: "famX",
        isFoundational: true,
        level: 2 as const,
        requiresPTClearance: true,
        progressionNextId: null,
      },
    ];
    const rows = buildProgressionMap(lib, [], user, NOW);
    const famX = rows.find((r) => r.family === "famX")!;
    expect(famX.locked).toBe("pt-clearance");
  });
});

describe("buildSafetyStrip", () => {
  it("reports ptCleared false by default and counts unreviewed logs", () => {
    const asym: AsymmetryLog[] = [
      { id: "a", userId: "u1", createdAt: NOW, date: "d", side: "right", type: "sharp-pain", reviewed: false },
      { id: "b", userId: "u1", createdAt: NOW, date: "d", side: "left", type: "tightness", reviewed: true },
    ];
    const strip = buildSafetyStrip(user, asym, NOW);
    expect(strip.ptCleared).toBe(false);
    expect(strip.unreviewed).toBe(1);
  });

  it("raises the alert on repeated same-side pain", () => {
    const asym: AsymmetryLog[] = [0, 1, 2].map((i) => ({
      id: `a${i}`,
      userId: "u1",
      createdAt: NOW - i * DAY,
      date: "d",
      side: "right" as const,
      type: "sharp-pain" as const,
      reviewed: false,
    }));
    expect(buildSafetyStrip(user, asym, NOW).alert.raised).toBe(true);
  });
});
