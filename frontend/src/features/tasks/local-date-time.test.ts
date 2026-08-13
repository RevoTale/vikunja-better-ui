import { describe, expect, it } from "vitest";

import { composeLocalDateTime } from "./local-date-time";

describe("composeLocalDateTime", () => {
  it("composes one timezone-free GraphQL value from normalized date and time parts", () => {
    expect(composeLocalDateTime({ date: "2026-08-14", time: "09:30" })).toBe("2026-08-14T09:30");
  });

  it("rejects impossible dates instead of relying on Date normalization", () => {
    expect(composeLocalDateTime({ date: "2026-02-29", time: "09:30" })).toBeUndefined();
  });

  it("rejects time values outside the minute-precision contract", () => {
    expect(composeLocalDateTime({ date: "2026-08-14", time: "24:00" })).toBeUndefined();
    expect(composeLocalDateTime({ date: "2026-08-14", time: "09:30:00" })).toBeUndefined();
  });
});
