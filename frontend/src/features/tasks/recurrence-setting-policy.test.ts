import { describe, expect, it } from "vitest";

import { recurrenceSettingPolicy } from "./recurrence-setting-policy";

describe("recurrenceSettingPolicy", () => {
  it("allows active timed completion-based day and week recurrence", () => {
    expect(
      recurrenceSettingPolicy({
        isDone: false,
        kind: "RECURRING",
        hasDueTime: true,
        recurrenceRule: {
          mode: "FROM_COMPLETION",
          unit: "WEEK",
          keepDueTime: false,
        },
      }),
    ).toEqual({ visible: true, canEnable: true });
  });

  it("keeps an incompatible marked task visible for corrective disablement", () => {
    expect(
      recurrenceSettingPolicy({
        isDone: false,
        kind: "INVALID",
        hasDueTime: true,
        recurrenceRule: {
          mode: "SCHEDULED_CYCLE",
          unit: "DAY",
          keepDueTime: true,
        },
      }),
    ).toEqual({ visible: true, canEnable: false });
  });

  it.each([
    { isDone: true, kind: "RECURRING" as const, hasDueTime: true },
    { isDone: false, kind: "RECURRING" as const, hasDueTime: false },
  ])("hides an inapplicable unmarked task", (task) => {
    expect(
      recurrenceSettingPolicy({
        ...task,
        recurrenceRule: {
          mode: "FROM_COMPLETION",
          unit: "DAY",
          keepDueTime: false,
        },
      }),
    ).toEqual({ visible: false, canEnable: false });
  });
});
