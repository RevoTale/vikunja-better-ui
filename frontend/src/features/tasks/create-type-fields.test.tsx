import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TaskTypeFields } from "./create-type-fields";
import type { TaskCreationValues } from "./task-creation-values";

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({ data: { session: { vikunjaUser: { weekStart: 1 } } } }),
}));

const values: TaskCreationValues = {
  job: false,
  title: "",
  projectId: "1",
  priority: "UNSET",
  dueDate: "",
  dueTime: "",
  planningStartsOn: "",
  planningEndsOn: "",
  planningFinishTime: "",
  planningStartTime: "",
  availableFromTime: "",
  planningSpecific: false,
  firstDueDate: "2026-08-27",
  availableFrom: "",
  availabilitySpecific: false,
  startDate: "2026-08-27",
  startTime: "09:00",
  durationMinutes: "60",
  completionWindowMinutes: "60",
};

const sharedProps = {
  errors: {},
  defaultDate: "2026-08-27",
  values,
  onFieldChange: () => undefined,
} as const;

describe("availability choices", () => {
  it.each(["one-time", "recurring"] as const)(
    "keeps %s availability automatic after midnight",
    (type) => {
      const draft = {
        ...values,
        planningStartsOn: "2026-08-27",
        planningEndsOn: "2026-08-31",
        availableFrom: "2026-08-27",
        firstDueDate: "2026-08-31",
      };
      for (const today of ["2026-08-27", "2026-08-28"]) {
        const markup = renderToStaticMarkup(
          <TaskTypeFields {...sharedProps} type={type} values={draft} defaultDate={today} />,
        );
        expect(markup).toContain('name="startNow" value="true"');
        expect(markup).toContain("Available now");
        const field = type === "one-time" ? "planningStartsOn" : "availableFrom";
        expect(markup).toContain(`name="${field}" value="${today}"`);
      }
    },
  );
  it("retains an explicit one-time start equal to the automatic date", () => {
    const markup = renderToStaticMarkup(
      <TaskTypeFields
        {...sharedProps}
        type="one-time"
        values={{
          ...values,
          planningEndsOn: "2026-08-31",
          planningStartsOn: "2026-08-27",
          planningSpecific: true,
        }}
      />,
    );
    expect(markup).toContain('id="planningStartsOn"');
    expect(markup).toContain('name="planningStartsOn" value="2026-08-27"');
  });
  it.each([
    ["2026-08-31", "2026-08-27"],
    ["2026-08-24", "2026-08-24"],
  ])("combines first due %s with automatic availability %s", (due, start) => {
    const markup = renderToStaticMarkup(
      <TaskTypeFields
        {...sharedProps}
        type="recurring"
        values={{ ...values, firstDueDate: due }}
      />,
    );
    expect(markup.match(/name="firstDueDate"/g)).toHaveLength(1);
    expect(markup).toContain(`name="availableFrom" value="${start}"`);
    expect(markup).toContain("Change availability");
    expect(markup).toContain('name="dueTime"');
  });

  it("shows the saved specific availability draft for Repeat", () => {
    const markup = renderToStaticMarkup(
      <TaskTypeFields
        {...sharedProps}
        type="recurring"
        values={{
          ...values,
          firstDueDate: "2026-09-10",
          availableFrom: "2026-09-02",
          availabilitySpecific: true,
        }}
      />,
    );
    expect(markup).toContain('name="availableFrom" value="2026-09-02"');
    expect(markup).toContain('id="availableFrom"');
  });
});

describe("TaskTypeFields", () => {
  it("prefills a one-time task with its contextual day", () => {
    const markup = renderToStaticMarkup(
      <TaskTypeFields
        {...sharedProps}
        values={{
          ...values,
          planningSpecific: true,
          planningStartsOn: "2026-08-31",
          planningEndsOn: "2026-08-31",
        }}
        type="one-time"
      />,
    );

    expect(markup).toContain('name="planningStartsOn" value="2026-08-31"');
    expect(markup).toContain('name="planningEndsOn" value="2026-08-31"');
    expect(markup).toContain('name="dueDate" value=""');
  });

  it("keeps generic one-time creation unscheduled", () => {
    const markup = renderToStaticMarkup(<TaskTypeFields {...sharedProps} type="one-time" />);

    expect(markup).toContain('name="dueDate" value=""');
    expect(markup).toContain('name="planningStartsOn" value=""');
    expect(markup).toContain('name="planningEndsOn" value=""');
    expect(markup).toContain('id="dueTime" disabled=""');
  });

  it.each([
    ["2026-08-31", "", "2026-08-27"],
    ["2026-08-24", "", "2026-08-24"],
    ["2026-08-31", "2026-08-29", "2026-08-29"],
  ])("resolves finish %s and start override %s to %s", (end, override, start) => {
    const markup = renderToStaticMarkup(
      <TaskTypeFields
        {...sharedProps}
        type="one-time"
        values={{
          ...values,
          planningSpecific: Boolean(override),
          planningEndsOn: end,
          planningStartsOn: override,
        }}
      />,
    );
    expect(markup).toContain(`name="planningStartsOn" value="${start}"`);
    expect(markup).toContain(`name="planningEndsOn" value="${end}"`);
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
