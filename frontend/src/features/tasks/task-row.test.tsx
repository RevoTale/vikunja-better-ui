import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type TaskItem, TaskRow } from "./task-row";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/tasks/1">{children}</a>,
}));

const task: TaskItem = {
  id: "1",
  title: "Read a book",
  description: "",
  kind: "ONE_TIME",
  isDone: false,
  doneAt: null,
  completionOutcome: null,
  priority: "HIGH",
  dueAt: "2026-08-14T07:30:00Z",
  hasDueTime: true,
  startAt: null,
  endAt: null,
  isOverdue: true,
  timezone: "UTC",
  project: { id: "1", title: "Reading", isDefault: true },
  recurrenceRule: null,
  labels: [],
};

function render(overrides: Partial<TaskItem> = {}, dayGrouped = false, projection = false) {
  return renderToStaticMarkup(
    <TaskRow
      task={{ ...task, ...overrides }}
      returnTo="/today"
      completingTaskID={undefined}
      onComplete={() => undefined}
      dayGrouped={dayGrouped}
      projection={projection}
    />,
  );
}

describe("overdue task schedule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T08:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("strikes the date and time, but not the title or Overdue status", () => {
    const markup = render();
    expect(markup).toMatch(/<p class="[^"]*line-through[^"]*">14 Aug<\/p>/);
    expect(markup).toMatch(/<p class="[^"]*line-through[^"]*">07:30<\/p>/);
    expect(markup).toContain('<p class="mt-1 text-xs font-medium">Overdue</p>');
    expect(markup).toContain('<a href="/tasks/1">Read a book</a>');
    expect(markup.match(/line-through/g)).toHaveLength(2);
  });

  it("strikes a date-only deadline from a previous day without inventing a time", () => {
    const markup = render({ dueAt: "2026-08-13T23:59:59Z", hasDueTime: false });
    expect(markup).toMatch(/<p class="[^"]*line-through[^"]*">13 Aug<\/p>/);
    expect(markup).not.toContain("23:59");
    expect(markup).toContain("Overdue");
  });

  it("strikes the job interval and completion deadline", () => {
    const markup = render({
      kind: "JOB",
      startAt: "2026-08-14T06:00:00Z",
      endAt: "2026-08-14T07:00:00Z",
    });
    expect(markup).toMatch(/<p class="[^"]*line-through[^"]*">06:00–07:00<\/p>/);
    expect(markup).toMatch(/<p class="[^"]*line-through[^"]*">Complete by 07:30<\/p>/);
  });

  it("strikes only the time in day-grouped rows", () => {
    const markup = render({}, true);
    expect(markup).toMatch(/<p class="[^"]*line-through[^"]*">07:30<\/p>/);
    expect(markup).not.toContain("14 Aug");
    expect(markup.match(/line-through/g)).toHaveLength(1);
  });

  it.each([
    { dueAt: "2026-08-14T09:00:00Z", isOverdue: false },
    { dueAt: "2026-08-14T23:59:59Z", hasDueTime: false, isOverdue: false },
    { isDone: true, isOverdue: false },
    { dueAt: null, isOverdue: false },
  ])("does not strike a non-overdue schedule: %j", (overrides) => {
    expect(render(overrides)).not.toContain("line-through");
  });

  it("does not present a computed occurrence as overdue", () => {
    const markup = render({}, true, true);
    expect(markup).not.toContain("line-through");
    expect(markup).not.toContain(">Overdue<");
  });

  it("does not strike the Anytime placeholder in a date-only weekly row", () => {
    const markup = render({ dueAt: "2026-08-13T23:59:59Z", hasDueTime: false }, true);
    expect(markup).toContain("Anytime");
    expect(markup).toContain("Overdue");
    expect(markup).not.toContain("line-through");
  });
});
