import { describe, expect, it } from "vitest";

import { taskKindLabel, taskKindLabels } from "./task-kind-label";

describe("taskKindLabel", () => {
  it("renders Job and Recurring as separate badges", () => {
    expect(
      taskKindLabels({
        kind: "JOB",
        isDone: false,
        recurrenceRule: { interval: 1, unit: "DAY", mode: "FROM_COMPLETION" },
        labels: [{ title: "job" }],
      }),
    ).toEqual(["Job", "Recurring"]);
  });

  it("keeps ordinary task-kind labels concise", () => {
    expect(
      taskKindLabel({ kind: "RECURRING", isDone: false, recurrenceRule: null, labels: [] }),
    ).toBe("Recurring");
  });
});
