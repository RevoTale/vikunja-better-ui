import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EditTaskSchedule } from "./edit-task-schedule";
import { editedPlanningError } from "./use-planning-schedule";

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({ data: { session: { vikunjaUser: { weekStart: 1 } } } }),
}));

const schedule = { start: "2026-11-01T00:00", end: "2026-11-30T23:59", due: "2026-12-01" };

describe("full task schedule editing", () => {
  it.each([schedule, { due: "2026-12-01" }])(
    "retains exact times and shifting for %j",
    (fields) => {
      const markup = renderToStaticMarkup(
        <EditTaskSchedule
          schedule={fields}
          setSchedule={() => undefined}
          timezone="UTC"
          today="2026-11-03"
          job={false}
          flexible
          invalidPlanning={null}
        />,
      );
      expect(markup).not.toContain("Exact schedule");
      expect(markup).toContain("Shift schedule");
      expect(markup).toContain('name="start-time"');
      expect(markup).toContain('name="end-time"');
    },
  );

  it("flags a deadline moved before an existing plan", () => {
    expect(editedPlanningError({ ...schedule, due: "2026-11-20" }, schedule, false)).toContain(
      "deadline",
    );
  });

  it("accepts an inclusive single-day plan without explicit times", () => {
    expect(editedPlanningError({ start: "2026-11-05", end: "2026-11-05" }, {}, false)).toBeNull();
    expect(
      editedPlanningError({ start: "2026-11-05T23:59", end: "2026-11-05" }, {}, false),
    ).toBeNull();
    expect(
      editedPlanningError({ start: "2026-11-05T14:00", end: "2026-11-05T13:00" }, {}, false),
    ).toBe("End must be after start.");
  });

  it("allows same-day timed deadlines and preserves unrelated legacy edits", () => {
    expect(
      editedPlanningError({ ...schedule, due: "2026-11-30T10:00" }, schedule, false),
    ).toBeNull();
    const legacy = { ...schedule, due: "2026-11-20" };
    expect(editedPlanningError(legacy, legacy, false)).toBeNull();
  });

  it("can change a deadline when both saved exact times display the same minute", () => {
    const current = { start: "2026-11-05T10:00", end: "2026-11-05T10:00" };
    expect(editedPlanningError({ ...current, due: "2026-11-06" }, current, false)).toBeNull();
    expect(editedPlanningError(current, { ...current, end: "2026-11-05T11:00" }, false)).toBe(
      "End must be after start.",
    );
  });

  it("validates explicitly changed planning dates and allows clearing both", () => {
    expect(editedPlanningError({ start: schedule.start }, schedule, true)).toBeTruthy();
    expect(editedPlanningError({ due: schedule.due }, schedule, true)).toBeNull();
  });

  it("checks a deadline against an end-only schedule without requiring a start", () => {
    const legacy = { end: "2026-11-30T12:00", due: "2026-12-05" };
    expect(editedPlanningError({ ...legacy, due: "2026-11-29" }, legacy, false)).toContain(
      "deadline",
    );
    expect(editedPlanningError({ ...legacy, due: "2026-11-30" }, legacy, false)).toBeNull();
  });
});
