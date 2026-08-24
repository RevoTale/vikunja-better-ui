import { describe, expect, it } from "vitest";

import { recurrenceHint } from "./recurrence-hint";

describe("recurrenceHint", () => {
  it("keeps date-only completion recurrence deliberately unscheduled", () => {
    expect(
      recurrenceHint({
        dueAt: "2026-08-24T20:59:59Z",
        hasDueTime: false,
        timezone: "Europe/Kyiv",
        recurrenceRule: {
          interval: 2,
          unit: "DAY",
          mode: "FROM_COMPLETION",
          keepDueTime: false,
        },
      }),
    ).toBe("Next: 2 days after completion.");
  });

  it("explains strict elapsed recurrence in hours", () => {
    expect(
      recurrenceHint({
        dueAt: "2026-08-24T17:00:00Z",
        hasDueTime: true,
        timezone: "Europe/Kyiv",
        recurrenceRule: {
          interval: 2,
          unit: "DAY",
          mode: "FROM_COMPLETION",
          keepDueTime: false,
        },
      }),
    ).toBe("Next: exactly 48 hours after completion.");
  });

  it("explains a fixed local due time without estimating a date", () => {
    expect(
      recurrenceHint({
        dueAt: "2026-08-24T17:00:00Z",
        hasDueTime: true,
        timezone: "Europe/Kyiv",
        recurrenceRule: {
          interval: 2,
          unit: "DAY",
          mode: "FROM_COMPLETION",
          keepDueTime: true,
        },
      }),
    ).toMatch(/^Next: 2 calendar days after completion at .+\.$/);
  });

  it("does not duplicate scheduled-cycle information", () => {
    expect(
      recurrenceHint({
        dueAt: "2026-08-24T17:00:00Z",
        hasDueTime: true,
        timezone: "Europe/Kyiv",
        recurrenceRule: {
          interval: 2,
          unit: "DAY",
          mode: "SCHEDULED_CYCLE",
          keepDueTime: false,
        },
      }),
    ).toBeNull();
  });
});
