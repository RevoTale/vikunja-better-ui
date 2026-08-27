import { describe, expect, it } from "vitest";

import { taskDetailActionPolicy } from "./task-detail-action-policy";

describe("taskDetailActionPolicy", () => {
  it("allows Skip only for active recurring tasks", () => {
    expect(
      taskDetailActionPolicy({ isDone: false, kind: "RECURRING", recurrenceRule: {} }),
    ).toEqual({
      canDelete: true,
      canSkip: true,
    });
  });

  it.each(["ONE_TIME", "INVALID"] as const)("does not allow Skip for %s", (kind) => {
    expect(taskDetailActionPolicy({ isDone: false, kind, recurrenceRule: null })).toEqual({
      canDelete: true,
      canSkip: false,
    });
  });

  it("allows Skip for an active recurring Job", () => {
    expect(taskDetailActionPolicy({ isDone: false, kind: "JOB", recurrenceRule: {} })).toEqual({
      canDelete: true,
      canSkip: true,
    });
  });

  it("allows no mutation action for completed tasks", () => {
    expect(taskDetailActionPolicy({ isDone: true, kind: "RECURRING", recurrenceRule: {} })).toEqual(
      {
        canDelete: false,
        canSkip: false,
      },
    );
  });
});
