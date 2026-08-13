import { describe, expect, it } from "vitest";

import { taskSchedule } from "./task-schedule";

const now = new Date("2026-08-14T08:00:00Z");

describe("taskSchedule", () => {
  it("shows an overdue timed deadline with an explicit text state", () => {
    expect(
      taskSchedule(
        {
          kind: "ONE_TIME",
          dueAt: "2026-08-14T07:30:00Z",
          hasDueTime: true,
          startAt: null,
          endAt: null,
          timezone: "UTC",
          isDone: false,
        },
        now,
      ),
    ).toEqual({
      date: "14 Aug",
      time: "07:30",
      status: "Overdue",
      urgency: "overdue",
      completeBy: null,
    });
  });

  it("warns when a timed deadline is within two hours", () => {
    expect(
      taskSchedule(
        {
          kind: "RECURRING",
          dueAt: "2026-08-14T09:30:00Z",
          hasDueTime: true,
          startAt: null,
          endAt: null,
          timezone: "UTC",
          isDone: false,
        },
        now,
      ).urgency,
    ).toBe("soon");
  });

  it("keeps later timed work neutral", () => {
    expect(
      taskSchedule(
        {
          kind: "ONE_TIME",
          dueAt: "2026-08-14T12:00:01Z",
          hasDueTime: true,
          startAt: null,
          endAt: null,
          timezone: "UTC",
          isDone: false,
        },
        now,
      ).urgency,
    ).toBe("normal");
  });

  it("shows date-only work without its synthetic end-of-day time", () => {
    expect(
      taskSchedule(
        {
          kind: "ONE_TIME",
          dueAt: "2026-08-14T20:59:59Z",
          hasDueTime: false,
          startAt: null,
          endAt: null,
          timezone: "Europe/Kyiv",
          isDone: false,
        },
        now,
      ),
    ).toEqual({
      date: "14 Aug",
      time: null,
      status: null,
      urgency: "muted",
      completeBy: null,
    });
  });

  it("distinguishes a job work interval from its completion deadline", () => {
    expect(
      taskSchedule(
        {
          kind: "JOB",
          dueAt: "2026-08-14T09:00:00Z",
          hasDueTime: true,
          startAt: "2026-08-14T07:15:00Z",
          endAt: "2026-08-14T08:00:00Z",
          timezone: "UTC",
          isDone: false,
        },
        now,
      ),
    ).toEqual({
      date: "14 Aug",
      time: "07:15–08:00",
      status: null,
      urgency: "soon",
      completeBy: "Complete by 09:00",
    });
  });

  it("still shows a job interval when Vikunja has no completion deadline", () => {
    expect(
      taskSchedule(
        {
          kind: "JOB",
          dueAt: null,
          hasDueTime: false,
          startAt: "2026-08-14T07:15:00Z",
          endAt: "2026-08-14T08:00:00Z",
          timezone: "UTC",
          isDone: false,
        },
        now,
      ),
    ).toEqual({
      date: "14 Aug",
      time: "07:15–08:00",
      status: null,
      urgency: "muted",
      completeBy: null,
    });
  });

  it("formats all values in the authoritative timezone", () => {
    expect(
      taskSchedule(
        {
          kind: "JOB",
          dueAt: "2026-08-13T23:00:00Z",
          hasDueTime: true,
          startAt: "2026-08-13T21:15:00Z",
          endAt: "2026-08-13T22:00:00Z",
          timezone: "Europe/Kyiv",
          isDone: false,
        },
        new Date("2026-08-13T20:00:00Z"),
      ),
    ).toMatchObject({
      date: "14 Aug",
      time: "00:15–01:00",
      completeBy: "Complete by 02:00",
    });
  });

  it("uses a clear empty state for tasks without a deadline", () => {
    expect(
      taskSchedule(
        {
          kind: "ONE_TIME",
          dueAt: null,
          hasDueTime: false,
          startAt: null,
          endAt: null,
          timezone: "UTC",
          isDone: false,
        },
        now,
      ),
    ).toEqual({
      date: "No deadline",
      time: null,
      status: null,
      urgency: "muted",
      completeBy: null,
    });
  });

  it("does not mark completed history items as currently overdue", () => {
    expect(
      taskSchedule(
        {
          kind: "ONE_TIME",
          dueAt: "2026-08-13T08:00:00Z",
          hasDueTime: true,
          startAt: null,
          endAt: null,
          timezone: "UTC",
          isDone: true,
        },
        now,
      ),
    ).toMatchObject({ status: null, urgency: "muted" });
  });
});
