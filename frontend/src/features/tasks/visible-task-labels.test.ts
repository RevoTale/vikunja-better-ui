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
      ]),
    ).toEqual([{ id: "2", title: "focus" }]);
  });
});
