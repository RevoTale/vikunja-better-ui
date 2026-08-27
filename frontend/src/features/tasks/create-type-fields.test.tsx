import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { TaskCreationValues } from "./autofill/task-creation-autofill";
import { TaskTypeFields } from "./create-type-fields";

const values: TaskCreationValues = {
  job: false,
  title: "",
  projectId: "1",
  priority: "UNSET",
  dueDate: "",
  dueTime: "",
  firstDueDate: "2026-08-27",
  startDate: "2026-08-27",
  startTime: "09:00",
  durationMinutes: "60",
  completionWindowMinutes: "60",
};

const sharedProps = {
  errors: {},
  defaultDate: "2026-08-27",
  values,
  autofilled: new Set<keyof TaskCreationValues>(),
  onFieldChange: () => undefined,
} as const;

describe("TaskTypeFields", () => {
  it("prefills a one-time task with its contextual day", () => {
    const markup = renderToStaticMarkup(
      <TaskTypeFields
        {...sharedProps}
        values={{ ...values, dueDate: "2026-08-31" }}
        type="one-time"
      />,
    );

    expect(markup).toContain('name="dueDate" value="2026-08-31"');
    expect(markup).not.toContain('name="dueTime" disabled=""');
  });

  it("keeps generic one-time creation unscheduled", () => {
    const markup = renderToStaticMarkup(<TaskTypeFields {...sharedProps} type="one-time" />);

    expect(markup).toContain('name="dueDate" value=""');
    expect(markup).toContain('id="dueTime" disabled=""');
  });

  it("composes recurring and Job fields with a time-of-day option", () => {
    const markup = renderToStaticMarkup(
      <TaskTypeFields {...sharedProps} values={{ ...values, job: true }} type="recurring" />,
    );

    expect(markup).toContain('name="startDate"');
    expect(markup).toContain('name="durationMinutes"');
    expect(markup).toContain('name="interval"');
    expect(markup).toContain('name="keepDueTime"');
    expect(markup).toContain("Keep start time of day");
    expect(markup).not.toContain('name="firstDueDate"');
  });
});
