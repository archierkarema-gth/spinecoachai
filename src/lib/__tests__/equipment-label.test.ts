import { describe, expect, it } from "vitest";
import { equipmentLabel, equipmentBadges } from "@/lib/equipment-label";

describe("equipmentLabel", () => {
  it("sentence-cases a multi-word equipment string (first letter only)", () => {
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
