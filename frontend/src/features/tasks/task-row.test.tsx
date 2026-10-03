import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type TaskItem, TaskRow } from "./task-row";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    "aria-label": label,
  }: {
    children: React.ReactNode;
    "aria-label"?: string;
  }) => (
    <a href="/tasks/1" aria-label={label}>
      {children}
    </a>
  ),
}));

const task: TaskItem = {
  commentCount: null,
  id: "1",
  title: "Read a book",
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

function render(
  overrides: Partial<TaskItem> = {},
  dayGrouped = false,
  projection = false,
  countLoading = false,
) {
  return renderToStaticMarkup(
    <TaskRow
      task={{ ...task, ...overrides }}
      returnTo="/today"
      completingTaskID={undefined}
      onComplete={() => undefined}
      dayGrouped={dayGrouped}
      projection={projection}
      countLoading={countLoading}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-14T08:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("task discussion metadata", () => {
  it("retains known counts while refreshing and uses a placeholder only for unknown counts", () => {
    const markup = render({ commentCount: 3 }, false, false, true);
    expect(markup).toContain("updating count");
    expect(markup).not.toContain('aria-label="3 comments on Read a book"');
    expect(markup).toContain(">3</span>");
    expect(markup).not.toContain('aria-label="Updating comment count"');
    expect(render({ commentCount: null }, false, false, true)).toContain(
      'aria-label="Updating comment count"',
    );
    expect(render({ commentCount: null })).not.toContain("Updating comment count");
    expect(render({ commentCount: 3 }, false, true, true)).not.toContain("Updating comment count");
  });
  it("shows a compact discussion link only for real tasks with comments", () => {
    expect(render({ commentCount: 3 })).toContain('aria-label="3 comments on Read a book"');
    expect(render({ commentCount: 1 })).toContain('aria-label="1 comment on Read a book"');
    for (const commentCount of [null, 0]) {
      expect(render({ commentCount })).not.toContain("comments on Read a book");
    }
    expect(render({ commentCount: 3 }, true, true)).not.toContain("comments on Read a book");
  });
  it("places discussion first in the shared metadata row after the completion deadline", () => {
    const markup = render({
      commentCount: 3,
      kind: "JOB",
      isDone: true,
      startAt: "2026-08-14T06:00:00Z",
      endAt: "2026-08-14T07:00:00Z",
    });
    const discussion = markup.indexOf('aria-label="3 comments on Read a book"');
    expect(markup).toContain('data-slot="task-metadata-row"');
    expect(discussion).toBeGreaterThan(markup.indexOf("Complete by 07:30"));
    expect(discussion).toBeGreaterThan(markup.indexOf('data-slot="task-metadata-row"'));
    expect(discussion).toBeLessThan(markup.indexOf('data-slot="task-metadata"'));
  });
});

describe("overdue task presentation", () => {
  it("replaces overdue date and time with one priority badge", () => {
    const markup = render();
    expect(markup).not.toContain("14 Aug");
    expect(markup).not.toContain("07:30");
    expect(markup.match(/>High</g)).toHaveLength(1);
    expect(markup.indexOf(">Overdue<")).toBeLessThan(markup.indexOf(">High<"));
    expect(markup.indexOf(">High<")).toBeLessThan(markup.indexOf('data-slot="task-content"'));
    expect(markup).toContain('<p class="mb-1 text-xs font-medium">Overdue</p>');
    expect(markup).toContain('<a href="/tasks/1">Read a book</a>');
    expect(markup).not.toContain("line-through");
  });

  it("hides a date-only overdue deadline without inventing a time", () => {
    const markup = render({ dueAt: "2026-08-13T23:59:59Z", hasDueTime: false });
    expect(markup).not.toContain("13 Aug");
    expect(markup).not.toContain("23:59");
    expect(markup).toContain("Overdue");
  });

  it("hides the overdue job interval and completion deadline", () => {
    const markup = render({
      kind: "JOB",
      startAt: "2026-08-14T06:00:00Z",
      endAt: "2026-08-14T07:00:00Z",
    });
    expect(markup).not.toContain("06:00–07:00");
    expect(markup).not.toContain("Complete by");
  });

  it("replaces the overdue time in day-grouped rows", () => {
    const markup = render({}, true);
    expect(markup).not.toContain("07:30");
    expect(markup).not.toContain("14 Aug");
    expect(markup.match(/>High</g)).toHaveLength(1);
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
    expect(markup).toContain("07:30");
    expect(markup.indexOf(">High<")).toBeGreaterThan(markup.indexOf('data-slot="task-metadata"'));
  });

  it("replaces Anytime in an overdue date-only weekly row", () => {
    const markup = render({ dueAt: "2026-08-13T23:59:59Z", hasDueTime: false }, true);
    expect(markup).not.toContain("Anytime");
    expect(markup).toContain("Overdue");
    expect(markup).not.toContain("line-through");
  });
  it("shows No priority once for an overdue task without a priority", () => {
    expect(render({ priority: "UNSET" }).match(/>No priority</g)).toHaveLength(1);
  });
  it.each([{ isDone: true }, { dueAt: "2026-08-14T09:00:00Z" }])(
    "keeps non-overdue priority in metadata: %j",
    (overrides) => {
      const markup = render(overrides);
      expect(markup).toContain("14 Aug");
      expect(markup.match(/>High</g)).toHaveLength(1);
      expect(markup.indexOf(">High<")).toBeGreaterThan(markup.indexOf('data-slot="task-metadata"'));
    },
  );
});
