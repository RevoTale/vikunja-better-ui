import { describe, expect, it } from "vitest";
import { planningPreset, planningWindowError, taskFinishDate } from "./planning-dates";

describe("planning calendar dates", () => {
  it("respects week start, leap years and year boundaries", () => {
    expect(planningPreset("week", "2027-01-01", 1)).toEqual({
      from: "2026-12-28",
      through: "2027-01-03",
    });
    expect(planningPreset("week", "2027-01-01", 0)).toEqual({
      from: "2026-12-27",
      through: "2027-01-02",
    });
    expect(planningPreset("month", "2028-02-10", 1)).toEqual({
      from: "2028-02-01",
      through: "2028-02-29",
    });
    expect(planningPreset("year", "2026-11-03", 1)).toEqual({
      from: "2026-01-01",
      through: "2026-12-31",
    });
  });
  it("requires a complete ordered window and preserves the deadline day", () => {
    expect(planningWindowError("", "")).toBeNull();
    expect(planningWindowError("2026-11-01", "")).toBeTruthy();
    expect(planningWindowError("2026-11-30", "2026-11-01")).toBeTruthy();
    expect(planningWindowError("2026-11-01", "2026-11-30", "2026-11-30")).toBeNull();
    expect(planningWindowError("2026-11-01", "2026-12-01", "2026-11-30")).toBeTruthy();
  });
  it("chooses the relevant completion in the requested period without changing job semantics", () => {
    const task = {
      kind: "ONE_TIME" as const,
      endAt: "2026-11-03T21:59:59Z",
      dueAt: "2026-12-05T12:00:00Z",
      timezone: "Europe/Kyiv",
    };
    expect(taskFinishDate(task)).toBe("2026-11-03");
    expect(taskFinishDate(task, { from: "2026-12-01", through: "2026-12-31" }, "2026-11-03")).toBe(
      "2026-12-05",
    );
    expect(taskFinishDate({ ...task, kind: "JOB" })).toBe("2026-12-05");
    expect(taskFinishDate({ ...task, endAt: null, dueAt: null })).toBeNull();
  });
});
