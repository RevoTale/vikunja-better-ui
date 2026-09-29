import { describe, expect, it } from "vitest";
import { completionFeedback } from "./completion-feedback";

const ordinary = { title: "Read", recurrenceRule: null };
const recurring = {
  ...ordinary,
  recurrenceRule: {
    interval: 2,
    unit: "DAY" as const,
    mode: "FROM_COMPLETION" as const,
    keepDueTime: false,
  },
};
const confirmed = { status: "CONFIRMED" as const, undoCapability: "undo", repairCapability: null };

describe("completion feedback capabilities", () => {
  it("offers Undo for ordinary completion only when supplied", () => {
    expect(completionFeedback(ordinary, confirmed)).toEqual({
      notice: "Read completed.",
      undo: { capability: "undo", title: "Read" },
    });
    expect(completionFeedback(ordinary, { ...confirmed, undoCapability: null })).toEqual({
      notice: "Read completed.",
    });
  });

  it("never offers Undo for a recurring completion", () => {
    expect(completionFeedback(recurring, confirmed)).toEqual({
      notice: "Recurring task completed and renewed.",
    });
  });

  it.each([null, "repair"])(
    "keeps repair-required completion distinct with capability %s",
    (capability) => {
      const result = completionFeedback(recurring, {
        ...confirmed,
        status: "CONFIRMED_REPAIR_REQUIRED",
        repairCapability: capability,
      });
      expect(result.notice).toContain("still needs repair");
      expect(result.undo).toBeUndefined();
      expect(result.repair).toEqual(capability ? { capability, title: "Read" } : undefined);
    },
  );
});
