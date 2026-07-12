import { describe, expect, it } from "vitest";
import { beepForSecond } from "@/lib/use-beep";

describe("beepForSecond", () => {
  it("ticks for 5 down to 1", () => {
    for (const n of [5, 4, 3, 2, 1]) {
      expect(beepForSecond(n)).toBe("tick");
    }
  });

  it("plays the final tone at 0", () => {
    expect(beepForSecond(0)).toBe("final");
  });

  it("is silent above 5 and below 0", () => {
    expect(beepForSecond(6)).toBeNull();
    expect(beepForSecond(-1)).toBeNull();
  });
});
