import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { describe, expect, it } from "vitest";
import { activityDataStatus, activitySubtitle, visibleActivity } from "./activity-view-model";

describe("personal activity scope", () => {
  const published = { total: 19 };
  const personal = { total: 3 };

  it("labels the anonymous preview while a personal read is pending, then replaces it", () => {
    const preview = visibleActivity(published, null, true, { loading: true });
    expect(preview.value).toBe(published);
    expect(activitySubtitle({ ...preview, authenticated: true }, "Last 14 days")).toBe(
      "Public snapshot · Loading yours…",
    );
    const ready = visibleActivity(published, personal, true, { loading: false });
    expect(ready.value).toBe(personal);
    expect(activitySubtitle({ ...ready, authenticated: true }, "Last 14 days")).toBe(
      "Your activity · Last 14 days",
    );
  });

  it.each(["FORBIDDEN", "UNAUTHENTICATED"])(
    "hides public and previously fetched personal totals after %s",
    (code) => {
      const error = new CombinedGraphQLErrors({
        errors: [{ message: "Unavailable", extensions: { code } }],
      });
      expect(visibleActivity(published, personal, true, { loading: false, error })).toMatchObject({
        value: null,
        valueSource: null,
        denied: code === "FORBIDDEN",
      });
    },
  );

  it("keeps only previously loaded personal values on a failed personal refresh", () => {
    const failure = { loading: false, error: new Error("Unavailable") };
    expect(visibleActivity(published, null, true, failure).value).toBeNull();
    expect(visibleActivity(published, personal, true, failure).value).toBe(personal);
  });

  it("never selects a personal aggregate when the session is anonymous", () => {
    expect(visibleActivity(published, personal, false, { loading: false })).toMatchObject({
      value: published,
      valueSource: "public",
    });
  });
});

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
