import { describe, expect, it } from "vitest";

import { createActionForPath } from "./create-action";

describe("createActionForPath", () => {
  it("creates a job from the Jobs tab", () => {
    expect(createActionForPath("/jobs")).toEqual({ label: "New job", type: "job" });
  });

  it.each(["/today", "/week", "/month", "/unscheduled", "/history"])(
    "creates a one-time task from %s",
    (pathname) => {
      expect(createActionForPath(pathname)).toEqual({
        label: "New task",
        type: "one-time",
      });
    },
  );
});
