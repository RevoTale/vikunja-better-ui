import { describe, expect, it } from "vitest";

import { creationType, positiveID, safeReturnTo } from "./route-search";

describe("safeReturnTo", () => {
  it.each(["https://example.com", "//example.com", "/login", "not-a-path", "/tasks/%"])(
    "rejects %s",
    (value) => {
      expect(safeReturnTo(value)).toBe("/today");
    },
  );

  it("keeps an allowlisted application URL with search state", () => {
    expect(safeReturnTo("/jobs?project=8&page=2")).toBe("/jobs?project=8&page=2");
  });
});

describe("creationType", () => {
  it.each(["one-time", "recurring", "job"] as const)("accepts %s", (value) => {
    expect(creationType(value)).toBe(value);
  });

  it("defaults unknown values", () => {
    expect(creationType("other")).toBe("one-time");
  });
});

describe("positiveID", () => {
  it("accepts positive IDs", () => {
    expect(positiveID("42")).toBe("42");
  });

  it.each(["0", "-1", "word"])("rejects %s", (value) => {
    expect(() => positiveID(value)).toThrow();
  });
});
