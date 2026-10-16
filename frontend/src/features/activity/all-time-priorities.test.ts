import { describe, expect, it } from "vitest";
import { filterAllTimePriorities } from "./all-time-priorities";

const activity = {
  total: 6,
  priorities: [
    { priority: "HIGH" as const, count: 3 },
    { priority: "LOW" as const, count: 3 },
  ],
  weeks: [
    {
      date: "2026-10-05",
      count: 3,
      completedWithDeadline: 2,
      completedOnTime: 1,
      priorities: [
        { priority: "HIGH" as const, count: 2, completedWithDeadline: 2, completedOnTime: 1 },
        { priority: "LOW" as const, count: 1, completedWithDeadline: 0, completedOnTime: 0 },
      ],
    },
    {
      date: "2026-10-12",
      count: 3,
      completedWithDeadline: 2,
      completedOnTime: 1,
      priorities: [
        { priority: "HIGH" as const, count: 1, completedWithDeadline: 1, completedOnTime: 1 },
        { priority: "LOW" as const, count: 2, completedWithDeadline: 1, completedOnTime: 0 },
      ],
    },
  ],
};

describe("all-time priority selection", () => {
  it("combines selected counts and denominators without mutating the snapshot", () => {
    const high = filterAllTimePriorities(activity, ["HIGH"]);
    expect(high.total).toBe(3);
    expect(high.weeks.map((week) => week.completedOnTime)).toEqual([1, 1]);
    expect(high.weeks.map((week) => week.completedWithDeadline)).toEqual([2, 1]);
    expect(high.priorities.map((priority) => priority.count)).toEqual([3, 0]);
    expect(filterAllTimePriorities(activity, ["HIGH", "LOW"])).toEqual(activity);
    expect(activity.total).toBe(6);
    expect(activity.weeks[0]?.count).toBe(3);
  });

  it("keeps the calendar axis with empty or absent selections and ignores duplicates", () => {
    const empty = filterAllTimePriorities(activity, []);
    expect(empty.total).toBe(0);
    expect(empty.weeks.map((week) => week.date)).toEqual(activity.weeks.map((week) => week.date));
    expect(empty.weeks.every((week) => week.count === 0 && week.completedWithDeadline === 0)).toBe(
      true,
    );
    expect(filterAllTimePriorities(activity, ["URGENT"]).total).toBe(0);
    expect(filterAllTimePriorities(activity, ["HIGH", "HIGH"]).total).toBe(3);
  });
});
