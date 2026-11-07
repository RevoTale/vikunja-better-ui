import { describe, expect, it } from "vitest";
import { safeReturnTo } from "@/app/route-search";
import { creationContext } from "./creation-context";
import { parsePlanningSearch } from "./planning-search";
import { validateTaskForm } from "./task-form-validation";
import { taskSchedule } from "./task-schedule";

const now = new Date("2026-11-03T12:00:00Z");
const task = {
  kind: "ONE_TIME" as const,
  startAt: "2026-10-31T22:00:00Z",
  endAt: "2026-11-30T21:59:59Z",
  dueAt: "2026-12-05T12:00:00Z",
  hasDueTime: true,
  isDone: false,
  timezone: "Europe/Kyiv",
};

describe("planning workflow", () => {
  it("shows a planning finish without synthetic time and keeps the deadline separate", () => {
    expect(taskSchedule(task, now, false, { active: true })).toMatchObject({
      date: "30 Nov",
      time: null,
      status: "Planned finish",
      urgency: "muted",
    });
    expect(taskSchedule(task, now, false, { active: true }).completeBy).toContain(
      "Available 1 Nov 2026 – 30 Nov 2026",
    );
    expect(taskSchedule(task, now).completeBy).toContain("Deadline 05 Dec, 14:00");
  });
  it("distinguishes a missed plan from an overdue deadline", () => {
    const missed = { ...task, endAt: "2026-11-02T21:59:59Z" };
    expect(taskSchedule(missed, now)).toMatchObject({ status: "Missed plan", urgency: "soon" });
    expect(taskSchedule({ ...missed, dueAt: "2026-11-03T11:00:00Z" }, now)).toMatchObject({
      status: "Overdue",
      urgency: "overdue",
    });
  });
  it("shows the deadline when it is the reason for appearing in a later period", () => {
    expect(
      taskSchedule(task, now, false, { period: { from: "2026-12-01", through: "2026-12-31" } })
        .date,
    ).toBe("05 Dec");
  });
  it("shows the selected finish even when an imported task has an earlier deadline outside the range", () => {
    const imported = { ...task, dueAt: "2026-11-20T12:00:00Z" };
    expect(
      taskSchedule(imported, now, false, { period: { from: "2026-11-30", through: "2026-11-30" } }),
    ).toMatchObject({
      date: "30 Nov",
      status: "Planned finish",
    });
  });
  it("retains view and filters through task detail and creation", () => {
    const path =
      "/plan?period=custom&from=2026-11-01&through=2026-11-30&project=7&label=8&priority=HIGH";
    expect(safeReturnTo(path)).toBe(path);
    expect(safeReturnTo("/active?project=7")).toBe("/active?project=7");
    expect(creationContext("/plan", path.split("?")[1] ?? "")).toEqual({
      project: "7",
      label: "8",
      priority: "HIGH",
    });
    expect(parsePlanningSearch({ period: "custom", from: "invalid", through: "" })).toMatchObject({
      period: "custom",
      from: "invalid",
      through: "",
    });
  });
  it("blocks incomplete, inverted and deadline-conflicting creation", () => {
    const form = new FormData();
    form.set("title", "Test");
    form.set("projectId", "7");
    form.set("priority", "UNSET");
    form.set("planningStartsOn", "2026-11-01");
    expect(validateTaskForm("one-time", form).planningEndsOn).toBeTruthy();
    form.set("planningEndsOn", "2026-11-30");
    expect(validateTaskForm("one-time", form)).toEqual({});
    form.set("dueDate", "2026-11-20");
    expect(validateTaskForm("one-time", form).planningEndsOn).toBeTruthy();
  });
});
