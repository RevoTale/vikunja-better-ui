import { describe, expect, it } from "vitest";
import { isInternalTaskLabel, taskLabelOptions } from "./task-label-options";

describe("task label options", () => {
  it("uses IDs even when titles collide", () => {
    expect(
      taskLabelOptions([
        { id: "1", title: "work" },
        { id: "2", title: "work" },
      ]),
    ).toEqual([
      { value: "1", label: "work (#1)" },
      { value: "2", label: "work (#2)" },
    ]);
  });
  it("protects all internal labels including future markers", () => {
    for (const title of ["vbu:job", " VBU:job ", "vbu:future", "VBU:date-only"])
      expect(isInternalTaskLabel(title)).toBe(true);
    for (const title of ["job", " JOB "]) expect(isInternalTaskLabel(title)).toBe(false);
    expect(
      taskLabelOptions([
        { id: "1", title: "job" },
        { id: "2", title: "vbu:future" },
        { id: "3", title: "work" },
      ]),
    ).toEqual([
      { value: "1", label: "job" },
      { value: "3", label: "work" },
    ]);
  });
});
