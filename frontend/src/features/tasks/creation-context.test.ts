import { describe, expect, it } from "vitest";
import { creationContext, creationContextFromReturnTo } from "./creation-context";

describe("creation context from active filters", () => {
  it("preserves daily footer filters without leaking them into weekly creation", () => {
    expect(
      creationContextFromReturnTo("/today?project=7&label=9&priority=UNSET&date=2026-10-18"),
    ).toEqual({ project: "7", label: "9", priority: "UNSET", date: "2026-10-18" });
    expect(creationContextFromReturnTo("/week?project=7&priority=HIGH")).toEqual({ project: "7" });
  });
  it.each(["/today", "/unscheduled", "/jobs"])("copies priority only from %s", (path) => {
    expect(creationContext(path, "?project=7&priority=HIGH")).toMatchObject({
      project: "7",
      priority: "HIGH",
    });
    expect(creationContext(path, "?priority=UNSET")).toEqual({ priority: "UNSET" });
    expect(creationContext(path, "?priority=all")).toEqual({});
    expect(creationContext(path, "?priority=3")).toEqual({});
  });
  it.each(["/week", "/history", "/activity", "/all-time-activity", "/tasks/new"])(
    "does not import priority from %s",
    (path) => {
      expect(creationContext(path, "?priority=HIGH")).toEqual({});
    },
  );
  it("keeps selected project, ordinary label ID and the selected Today date", () => {
    expect(creationContext("/today", "?project=7&label=9&date=2026-10-18&page=4")).toEqual({
      project: "7",
      label: "9",
      date: "2026-10-18",
    });
  });
  it("ignores all, invalid filters and non-list pages", () => {
    expect(creationContext("/today", "?project=all&label=-2&date=wrong")).toEqual({});
    expect(creationContext("/tasks/new", "?project=7&label=9")).toEqual({});
    expect(creationContext("/week", "?project=7&week=2026-10-12&label=9")).toEqual({
      project: "7",
    });
    expect(creationContext("/jobs", "?project=7")).toEqual({ project: "7" });
  });
});
