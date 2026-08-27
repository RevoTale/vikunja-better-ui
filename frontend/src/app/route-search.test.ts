import { describe, expect, it } from "vitest";

import {
  creationDate,
  creationProjectID,
  creationType,
  positiveID,
  safeReturnTo,
} from "./route-search";

describe("safeReturnTo", () => {
  it.each(["https://example.com", "//example.com", "/login", "not-a-path", "/tasks/%"])(
    "rejects %s",
    (value) => {
      expect(safeReturnTo(value)).toBe("/today");
    },
  );

  it("keeps an allowlisted application URL with search state", () => {
    expect(safeReturnTo("/jobs?project=8&page=2")).toBe("/jobs?project=8&page=2");
    expect(safeReturnTo("/tasks/42/delete?returnTo=%2Ftoday")).toBe(
      "/tasks/42/delete?returnTo=%2Ftoday",
    );
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

describe("creationDate", () => {
  it("accepts a real local calendar date", () => {
    expect(creationDate("2026-08-24")).toBe("2026-08-24");
  });

  it.each([undefined, "2026-02-30", "24-08-2026", "next monday"])(
    "ignores invalid creation date %s",
    (value) => {
      expect(creationDate(value)).toBeUndefined();
    },
  );
});

describe("creationProjectID", () => {
  it("accepts a positive project ID", () => {
    expect(creationProjectID("42")).toBe("42");
  });

  it.each([undefined, "all", "0", "-1"])("ignores invalid project ID %s", (value) => {
    expect(creationProjectID(value)).toBeUndefined();
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
