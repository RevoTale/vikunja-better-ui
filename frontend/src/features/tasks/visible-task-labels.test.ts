import { describe, expect, it } from "vitest";

import { visibleTaskLabels } from "./visible-task-labels";

describe("visibleTaskLabels", () => {
  it("keeps user labels while hiding application marker labels", () => {
    expect(
      visibleTaskLabels([
        { id: "1", title: "job" },
        { id: "2", title: "focus" },
        { id: "3", title: "vbu:date-only" },
        { id: "4", title: "vbu:recurrence-history" },
        { id: "5", title: "vbu:skipped" },
        { id: "6", title: "vbu:fixed-due-time" },
        { id: "7", title: "vbu:fixed-due-time " },
      ]),
    ).toEqual([
      { id: "2", title: "focus" },
      { id: "7", title: "vbu:fixed-due-time " },
    ]);
  });
});
