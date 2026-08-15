import { describe, expect, it } from "vitest";

import { serverTaskFormErrors, validateTaskForm } from "./task-form-validation";

describe("validateTaskForm", () => {
  it("reports each invalid shared field", () => {
    expect(
      validateTaskForm("one-time", values({ title: "   ", projectId: "", priority: "INVALID" })),
    ).toEqual({
      title: "Enter a title.",
      projectId: "Choose a project.",
      priority: "Choose a priority.",
    });
  });

  it("requires a date when a one-time task has a due time", () => {
    expect(validateTaskForm("one-time", values({ dueTime: "09:30" }))).toEqual({
      dueTime: "Choose a due date before setting a time.",
    });
  });

  it("validates recurring dates, intervals, units, and modes", () => {
    expect(
      validateTaskForm(
        "recurring",
        values({
          firstDueDate: "",
          interval: "2",
          unit: "MONTH",
          mode: "FROM_COMPLETION",
        }),
      ),
    ).toEqual({
      firstDueDate: "Choose the first due date.",
      interval: "Monthly recurrence supports every 1 month.",
      mode: "Monthly recurrence must use Scheduled cycle.",
    });
  });

  it("rejects recurrence intervals too large for Vikunja", () => {
    expect(
      validateTaskForm("recurring", values({ interval: "106752", unit: "DAY" })),
    ).toMatchObject({ interval: "Choose a smaller interval." });
    expect(
      validateTaskForm("recurring", values({ interval: "15251", unit: "WEEK" })),
    ).toMatchObject({ interval: "Choose a smaller interval." });
  });

  it("requires an eligible timed recurrence when keeping the due time", () => {
    expect(validateTaskForm("recurring", values({ keepDueTime: "on", dueTime: "" }))).toMatchObject(
      { dueTime: "Choose a due time to keep." },
    );
    expect(
      validateTaskForm(
        "recurring",
        values({ keepDueTime: "on", dueTime: "20:00", mode: "SCHEDULED_CYCLE" }),
      ),
    ).toMatchObject({ mode: "Keep due time requires From completion." });
    expect(
      validateTaskForm(
        "recurring",
        values({ keepDueTime: "on", dueTime: "20:00", unit: "MONTH", mode: "SCHEDULED_CYCLE" }),
      ),
    ).toMatchObject({ unit: "Keep due time supports days or weeks." });
  });

  it("validates all required job fields", () => {
    expect(
      validateTaskForm(
        "job",
        values({
          startDate: "",
          startTime: "",
          durationMinutes: "0",
          completionWindowMinutes: "1.5",
        }),
      ),
    ).toEqual({
      startDate: "Choose a start date.",
      startTime: "Choose a start time.",
      durationMinutes: "Enter a whole number of 1 or more.",
      completionWindowMinutes: "Enter a whole number of 1 or more.",
    });
  });

  it("validates the date and time controls independently", () => {
    expect(
      validateTaskForm("job", values({ startDate: "2026-02-29", startTime: "24:00" })),
    ).toMatchObject({
      startDate: "Enter a valid date.",
      startTime: "Enter a valid time.",
    });
  });

  it("rejects job dates that exceed the supported calendar range", () => {
    expect(
      validateTaskForm(
        "job",
        values({
          startDate: "9999-12-31",
          startTime: "23:00",
          durationMinutes: "60",
          completionWindowMinutes: "60",
        }),
      ),
    ).toMatchObject({ durationMinutes: "The job end must be before year 10000." });
  });

  it("accepts valid values for every task type", () => {
    expect(
      validateTaskForm("one-time", values({ dueDate: "2026-08-14", dueTime: "09:30" })),
    ).toEqual({});
    expect(validateTaskForm("recurring", values())).toEqual({});
    expect(validateTaskForm("job", values())).toEqual({});
  });

  it("allows a job without a title", () => {
    expect(validateTaskForm("job", values({ title: "   " }))).toEqual({});
  });

  it("places rare timezone validation failures beside the responsible field", () => {
    expect(
      serverTaskFormErrors(
        "job",
        values(),
        "local time is ambiguous because of a timezone transition",
      ),
    ).toEqual({
      startTime: "This time is ambiguous in your Vikunja timezone. Choose another time.",
    });
    expect(
      serverTaskFormErrors(
        "recurring",
        values({ dueTime: "03:30" }),
        "local time does not exist because of a timezone transition",
      ),
    ).toEqual({
      dueTime: "This time does not exist in your Vikunja timezone. Choose another time.",
    });
  });

  it("places inaccessible-project failures beside the project selector", () => {
    expect(
      serverTaskFormErrors("one-time", values(), "The selected project is not accessible."),
    ).toEqual({ projectId: "Choose an accessible project." });
  });
});

function values(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  const defaults = {
    title: "Task",
    projectId: "1",
    priority: "UNSET",
    dueDate: "",
    dueTime: "",
    firstDueDate: "2026-08-14",
    interval: "1",
    unit: "DAY",
    mode: "FROM_COMPLETION",
    startDate: "2026-08-14",
    startTime: "09:00",
    durationMinutes: "60",
    completionWindowMinutes: "60",
  };
  for (const [name, value] of Object.entries({ ...defaults, ...overrides })) {
    form.set(name, value);
  }
  return form;
}
