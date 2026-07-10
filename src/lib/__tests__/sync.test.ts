import { describe, expect, it } from "vitest";
import { idsToPull } from "@/lib/sync";

interface Rec {
  id: string;
  v: number;
}

describe("idsToPull", () => {
  it("returns only remote records missing locally", () => {
    const local: Rec[] = [{ id: "a", v: 1 }];
    const remote: Rec[] = [
      { id: "a", v: 1 },
      { id: "b", v: 2 },
    ];
    expect(idsToPull(local, remote)).toEqual([{ id: "b", v: 2 }]);
  });

  it("returns nothing when local already has everything", () => {
    const local: Rec[] = [{ id: "a", v: 1 }];
    const remote: Rec[] = [{ id: "a", v: 1 }];
    expect(idsToPull(local, remote)).toEqual([]);
  });
});
