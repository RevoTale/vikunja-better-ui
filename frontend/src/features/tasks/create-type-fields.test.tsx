import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TaskTypeFields } from "./create-type-fields";

const sharedProps = {
  errors: {},
  defaultDate: "2026-08-27",
  initialDate: undefined,
  jobStart: { date: "2026-08-27", time: "09:00" },
  onJobStartChange: () => undefined,
  isJob: false,
} as const;

describe("TaskTypeFields", () => {
  it("prefills a one-time task with its contextual day", () => {
    const markup = renderToStaticMarkup(
      <TaskTypeFields {...sharedProps} initialDate="2026-08-31" type="one-time" />,
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
    const markup = renderToStaticMarkup(<TaskTypeFields {...sharedProps} type="recurring" isJob />);

    expect(markup).toContain('name="startDate"');
    expect(markup).toContain('name="durationMinutes"');
    expect(markup).toContain('name="interval"');
    expect(markup).toContain('name="keepDueTime"');
    expect(markup).toContain("Keep start time of day");
    expect(markup).not.toContain('name="firstDueDate"');
  });
});
