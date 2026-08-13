import { describe, expect, it } from "vitest";

import { taskKindLabel } from "./task-kind-label";

describe("taskKindLabel", () => {
  it("explains when a task is both recurring and a job", () => {
    expect(
      taskKindLabel({
        kind: "INVALID",
        isDone: false,
        recurrenceRule: { interval: 1, unit: "DAY", mode: "FROM_COMPLETION" },
        labels: [{ title: "job" }],
      }),
    ).toBe("Invalid: both recurring and job");
  });

  it("keeps ordinary task-kind labels concise", () => {
    expect(
      taskKindLabel({ kind: "RECURRING", isDone: false, recurrenceRule: null, labels: [] }),
    ).toBe("Recurring");
  });
});
