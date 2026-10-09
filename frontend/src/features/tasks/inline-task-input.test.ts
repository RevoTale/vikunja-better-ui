import { describe, expect, it } from "vitest";
import type { TaskDetailsQuery } from "@/graphql/graphql";
import { inlineTaskInput } from "./inline-task-input";

const task: NonNullable<TaskDetailsQuery["task"]> = {
  id: "42",
  version: "original",
  title: "Read",
  description: "<p><strong>Keep me</strong></p>",
  kind: "JOB",
  isDone: false,
  doneAt: null,
  completionOutcome: null,
  priority: "HIGH",
  dueAt: "2026-10-09T17:00:00Z",
  hasDueTime: true,
  startAt: "2026-10-09T15:00:00Z",
  endAt: "2026-10-09T16:00:00Z",
  isOverdue: false,
  timezone: "Europe/Kyiv",
  project: { id: "1", title: "Personal", isDefault: false },
  recurrenceRule: { interval: 2, unit: "DAY", mode: "FROM_COMPLETION", keepDueTime: true },
  labels: [
    { id: "1", title: "vbu:job" },
    { id: "2", title: "work" },
  ],
};

describe("inline task update snapshot", () => {
  it("preserves HTML, recurrence, labels and the original version when editing priority", () => {
    const input = { ...inlineTaskInput(task), priority: "LOW" };
    expect(input.expectedVersion).toBe("original");
    expect(input.description).toBe(task.description);
    expect(input.recurrence).toEqual(task.recurrenceRule);
    expect(input.labelIds).toEqual(["2"]);
    expect(input.job).toBe(true);
    expect(input.startAt).toBe("2026-10-09T18:00");
    expect(input.endAt).toBe("2026-10-09T19:00");
    expect(input.dueDate).toBe("2026-10-09");
    expect(input.dueTime).toBe("20:00");
  });

  it("preserves date-only deadlines and absence without inventing a time", () => {
    const input = inlineTaskInput({ ...task, dueAt: "2026-10-09T20:59:59Z", hasDueTime: false });
    expect(input.dueDate).toBe("2026-10-09");
    expect(input.dueTime).toBeNull();
    const empty = inlineTaskInput({
      ...task,
      dueAt: null,
      startAt: null,
      endAt: null,
      recurrenceRule: null,
    });
    expect(empty.dueDate).toBeNull();
    expect(empty.startAt).toBeNull();
    expect(empty.endAt).toBeNull();
    expect(empty.recurrence).toBeNull();
  });
});
