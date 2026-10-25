import { describe, expect, it } from "vitest";
import { activityDataStatus } from "./activity-view-model";

describe("activityDataStatus", () => {
  it("keeps public snapshots identified while private data loads", () => {
    expect(activityDataStatus("public", true)).toBe("Public snapshot cached for 1 hour.");
  });

  it("does not present retained private data as current during refresh", () => {
    expect(activityDataStatus("private", true)).toBe("Previously loaded private data.");
  });

  it("confirms private data only after loading completes", () => {
    expect(activityDataStatus("private", false)).toBe("Current private data.");
  });

  it("does not infer freshness without a known source", () => {
    expect(activityDataStatus(null, false)).toBe("Activity data.");
  });
});
