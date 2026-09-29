import { describe, expect, it } from "vitest";
import { defaultTaskCreationValues } from "./task-creation-values";

const context = {
  job: false,
  projectId: "7",
  today: "2026-10-05",
  date: undefined,
  jobStart: { date: "2026-10-05", time: "09:00" },
};

describe("task creation defaults", () => {
  it("starts unscheduled with no title or priority", () => {
    expect(defaultTaskCreationValues(context)).toMatchObject({
      job: false,
      title: "",
      projectId: "7",
      priority: "UNSET",
      dueDate: "",
      dueTime: "",
    });
  });
  it("keeps the selected day for every schedule variant", () => {
    expect(defaultTaskCreationValues({ ...context, date: "2026-10-06" })).toMatchObject({
      dueDate: "2026-10-06",
      firstDueDate: "2026-10-06",
      startDate: "2026-10-06",
    });
  });
  it("keeps normal Job defaults rather than the previous form", () => {
    const previous = defaultTaskCreationValues(context);
    previous.title = "Old task";
    previous.durationMinutes = "240";
    expect(defaultTaskCreationValues({ ...context, job: true })).toMatchObject({
      job: true,
      title: "",
      startTime: "09:00",
      durationMinutes: "60",
      completionWindowMinutes: "60",
    });
  });
});
