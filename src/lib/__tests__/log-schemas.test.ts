import { describe, expect, it } from "vitest";
import { reassessmentLogSchema, newReassessmentLogInputSchema } from "@/lib/log-schemas";

describe("reassessmentLogSchema", () => {
  it("accepts a full valid log", () => {
    const result = reassessmentLogSchema.safeParse({
      id: "r1",
      userId: "u1",
      createdAt: 1000,
      flexibility: 3,
      balance: 4,
      breathingQuality: 5,
      painAreas: "leher",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a log without optional painAreas", () => {
    const result = reassessmentLogSchema.safeParse({
      id: "r1",
      userId: "u1",
      createdAt: 1000,
      flexibility: 1,
      balance: 1,
      breathingQuality: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a score outside 1..5", () => {
    const result = reassessmentLogSchema.safeParse({
      id: "r1",
      userId: "u1",
      createdAt: 1000,
      flexibility: 6,
      balance: 3,
      breathingQuality: 3,
    });
    expect(result.success).toBe(false);
  });

  it("newReassessmentLogInputSchema omits id and createdAt", () => {
    const result = newReassessmentLogInputSchema.safeParse({
      userId: "u1",
      flexibility: 2,
      balance: 2,
      breathingQuality: 2,
    });
    expect(result.success).toBe(true);
  });
});
