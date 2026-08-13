import { describe, expect, it } from "vitest";

import { jobTitlePlaceholder } from "./job-title";

describe("jobTitlePlaceholder", () => {
  it("describes the backend title derived from a local start", () => {
    expect(jobTitlePlaceholder({ date: "2026-08-12", time: "09:30" })).toBe("Job 2026-08-12 09:30");
  });

  it("does not invent a title for an invalid start", () => {
    expect(jobTitlePlaceholder({ date: "", time: "" })).toBe("");
  });
});
