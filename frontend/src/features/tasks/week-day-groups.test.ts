import { describe, expect, it } from "vitest";

import { groupCurrentWeekDays } from "./week-day-groups";

const days = [
  { date: "2026-08-24" },
  { date: "2026-08-25" },
  { date: "2026-08-26" },
  { date: "2026-08-27" },
  { date: "2026-08-28" },
  { date: "2026-08-29" },
  { date: "2026-08-30" },
];

describe("groupCurrentWeekDays", () => {
  it("separates chronological earlier and upcoming days around today", () => {
    const result = groupCurrentWeekDays(days, "2026-08-26");

    expect(result).toEqual({
      today: { date: "2026-08-26" },
      upcoming: days.slice(3),
      earlier: days.slice(0, 2),
    });
  });

  it("leaves the earlier group empty on the first day of the week", () => {
    const result = groupCurrentWeekDays(days, "2026-08-24");

    expect(result?.earlier).toEqual([]);
    expect(result?.upcoming).toEqual(days.slice(1));
  });

  it("leaves the upcoming group empty on the last day of the week", () => {
    const result = groupCurrentWeekDays(days, "2026-08-30");

    expect(result?.upcoming).toEqual([]);
    expect(result?.earlier).toEqual(days.slice(0, 6));
  });

  it("returns no grouping when the selected week does not contain today", () => {
    expect(groupCurrentWeekDays(days, "2026-08-31")).toBeUndefined();
  });
});
