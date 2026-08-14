import { describe, expect, it } from "vitest";

import { taskDetailActionPolicy } from "./task-detail-action-policy";

describe("taskDetailActionPolicy", () => {
  it("allows Skip only for active recurring tasks", () => {
    expect(taskDetailActionPolicy({ isDone: false, kind: "RECURRING" })).toEqual({
      canDelete: true,
      canSkip: true,
    });
  });

  it.each(["ONE_TIME", "JOB", "INVALID"] as const)("does not allow Skip for %s", (kind) => {
    expect(taskDetailActionPolicy({ isDone: false, kind })).toEqual({
      canDelete: true,
      canSkip: false,
    });
  });

  it("allows no mutation action for completed tasks", () => {
    expect(taskDetailActionPolicy({ isDone: true, kind: "RECURRING" })).toEqual({
      canDelete: false,
      canSkip: false,
    });
  });
});
