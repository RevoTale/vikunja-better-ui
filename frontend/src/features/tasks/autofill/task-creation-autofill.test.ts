import { describe, expect, it } from "vitest";

import {
  changeAutofillField,
  createInitialAutofillState,
  switchAutofillVariant,
  type TaskCreationAutofillMemory,
} from "./task-creation-autofill";

const defaults = {
  baseType: "one-time",
  defaultDate: "2026-08-27",
  defaultProjectId: "10",
  defaultJobStart: { date: "2026-08-27", time: "09:00" },
  accessibleProjectIds: ["10", "20"],
} as const;

const memory: TaskCreationAutofillMemory = {
  variant: "task",
  records: {
    "one-time:task": {
      title: "Remembered task",
      projectId: "20",
      priority: "HIGH",
      dueDate: "2026-08-30",
      dueTime: "18:00",
    },
    "one-time:job": {
      title: "Remembered job",
      projectId: "20",
      priority: "LOW",
      startDate: "2026-09-01",
      startTime: "08:30",
      durationMinutes: "45",
      completionWindowMinutes: "90",
    },
  },
};

describe("task creation autofill state", () => {
  it("keeps explicit route context ahead of remembered values", () => {
    const state = createInitialAutofillState({
      ...defaults,
      explicitDate: "2026-08-31",
      explicitProjectId: "10",
      memory,
    });

    expect(state.values.dueDate).toBe("2026-08-31");
    expect(state.values.projectId).toBe("10");
    expect(state.values.title).toBe("Remembered task");
    expect(state.autofilled).toEqual(new Set(["title", "priority", "dueTime"]));
  });

  it("treats an equal manual value as user-owned", () => {
    const initial = createInitialAutofillState({ ...defaults, memory });

    const edited = changeAutofillField(initial, "title", "Remembered task");

    expect(edited.values.title).toBe("Remembered task");
    expect(edited.dirty).toContain("title");
    expect(edited.autofilled).not.toContain("title");
  });

  it("preserves dirty shared values while loading untouched fields from a Job scope", () => {
    const initial = createInitialAutofillState({ ...defaults, memory });
    const edited = changeAutofillField(initial, "title", "My current title");

    const switched = switchAutofillVariant(edited, true, defaults, memory);

    expect(switched.values.job).toBe(true);
    expect(switched.values.title).toBe("My current title");
    expect(switched.values.startDate).toBe("2026-09-01");
    expect(switched.values.startTime).toBe("08:30");
    expect(switched.values.durationMinutes).toBe("45");
    expect(switched.autofilled).not.toContain("title");
    expect(switched.autofilled).toContain("startDate");
    expect(switched.dirty).toEqual(new Set(["title", "job"]));
  });

  it("does not restore remembered data over a field edited before switching back", () => {
    const initial = createInitialAutofillState({ ...defaults, memory });
    const editedDate = changeAutofillField(initial, "dueDate", "2026-09-10");
    const job = switchAutofillVariant(editedDate, true, defaults, memory);

    const task = switchAutofillVariant(job, false, defaults, memory);

    expect(task.values.dueDate).toBe("2026-09-10");
    expect(task.autofilled).not.toContain("dueDate");
  });

  it("ignores a remembered project that is no longer accessible", () => {
    const state = createInitialAutofillState({
      ...defaults,
      memory: {
        variant: "task",
        records: { "one-time:task": { projectId: "404" } },
      },
    });

    expect(state.values.projectId).toBe("10");
    expect(state.autofilled).not.toContain("projectId");
  });

  it("uses a remembered Job variant only when the route does not specify one", () => {
    const rememberedJob = { ...memory, variant: "job" } as const;

    expect(createInitialAutofillState({ ...defaults, memory: rememberedJob }).values.job).toBe(
      true,
    );
    expect(
      createInitialAutofillState({
        ...defaults,
        explicitJob: true,
        memory: { ...memory, variant: "task" },
      }).values.job,
    ).toBe(true);
  });
});
