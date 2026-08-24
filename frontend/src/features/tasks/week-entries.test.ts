import { describe, expect, it } from "vitest";

import { mergeWeekEntries } from "./week-entries";

describe("mergeWeekEntries", () => {
  it("places active and computed work in due-time order", () => {
    const entries = mergeWeekEntries(
      [
        { id: "late", dueAt: "2026-08-24T18:00:00Z" },
        { id: "early", dueAt: "2026-08-24T08:00:00Z" },
      ],
      [{ dueAt: "2026-08-24T12:00:00Z", sourceTask: { id: "expected" } }],
    );

    expect(entries.map((entry) => entry.kind)).toEqual(["task", "projection", "task"]);
  });

  it("preserves source order for entries of the same kind and due time", () => {
    const tasks = [
      { id: "first", dueAt: "2026-08-24T08:00:00Z" },
      { id: "second", dueAt: "2026-08-24T08:00:00Z" },
    ];

    expect(
      mergeWeekEntries(tasks, []).map((entry) =>
        entry.kind === "task" ? entry.task.id : "projection",
      ),
    ).toEqual(["first", "second"]);
  });

  it("uses start, otherwise end, otherwise due as each active task's sort time", () => {
    const entries = mergeWeekEntries(
      [
        {
          id: "job",
          startAt: "2026-08-24T10:00:00Z",
          endAt: "2026-08-24T11:00:00Z",
          dueAt: "2026-08-24T12:00:00Z",
        },
        {
          id: "end-only",
          startAt: null,
          endAt: "2026-08-24T09:00:00Z",
          dueAt: "2026-08-24T13:00:00Z",
        },
        {
          id: "due-only",
          startAt: null,
          endAt: null,
          dueAt: "2026-08-24T08:00:00Z",
        },
      ],
      [],
    );

    expect(entries.map((entry) => (entry.kind === "task" ? entry.task.id : "projection"))).toEqual([
      "due-only",
      "end-only",
      "job",
    ]);
  });

  it("uses end and due times to order tasks with the same start time", () => {
    const entries = mergeWeekEntries(
      [
        {
          id: "later-due",
          startAt: "2026-08-24T10:00:00Z",
          endAt: "2026-08-24T11:00:00Z",
          dueAt: "2026-08-24T13:00:00Z",
        },
        {
          id: "earlier-due",
          startAt: "2026-08-24T10:00:00Z",
          endAt: "2026-08-24T11:00:00Z",
          dueAt: "2026-08-24T12:00:00Z",
        },
        {
          id: "earlier-end",
          startAt: "2026-08-24T10:00:00Z",
          endAt: "2026-08-24T10:30:00Z",
          dueAt: "2026-08-24T14:00:00Z",
        },
      ],
      [],
    );

    expect(entries.map((entry) => (entry.kind === "task" ? entry.task.id : "projection"))).toEqual([
      "earlier-end",
      "earlier-due",
      "later-due",
    ]);
  });

  it("merges computed due times with an active task's preferred schedule time", () => {
    const entries = mergeWeekEntries(
      [
        {
          id: "job",
          startAt: "2026-08-24T10:00:00Z",
          endAt: "2026-08-24T11:00:00Z",
          dueAt: "2026-08-24T08:00:00Z",
        },
      ],
      [{ dueAt: "2026-08-24T09:00:00Z", sourceTask: { id: "computed" } }],
    );

    expect(entries.map((entry) => entry.kind)).toEqual(["projection", "task"]);
  });
});
