import { describe, expect, it } from "vitest";
import { mergeById, idsToPull } from "@/lib/sync";

interface Rec {
  id: string;
  v: number;
}

describe("mergeById", () => {
  it("unions disjoint sets", () => {
    const merged = mergeById<Rec>([{ id: "a", v: 1 }], [{ id: "b", v: 2 }]);
    expect(merged).toHaveLength(2);
  });

  it("prefers the local copy on id conflict", () => {
    const merged = mergeById<Rec>(
      [{ id: "a", v: 1 }],
      [{ id: "a", v: 99 }]
    );
    expect(merged).toEqual([{ id: "a", v: 1 }]);
  });
});

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
