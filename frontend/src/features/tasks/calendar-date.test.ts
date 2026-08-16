import { describe, expect, it } from "vitest";

import { calendarDateFromISO, isoDateFromCalendarDate } from "./calendar-date";

describe("calendar date conversion", () => {
  it("round-trips a date without applying the browser timezone", () => {
    const selected = calendarDateFromISO("2026-03-29");

    expect(selected).toBeDefined();
    expect(isoDateFromCalendarDate(selected)).toBe("2026-03-29");
  });

  it("rejects an invalid date", () => {
    expect(calendarDateFromISO("2026-02-29")).toBeUndefined();
  });
});
