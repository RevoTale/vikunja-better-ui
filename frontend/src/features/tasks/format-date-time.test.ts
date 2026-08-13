import { describe, expect, it } from "vitest";

import { formatDateTime } from "./format-date-time";

describe("formatDateTime", () => {
  it("always displays hours in 24-hour format", () => {
    const formatted = formatDateTime("2026-08-14T21:07:00Z", true, "UTC");

    expect(formatted).toBe("14-08-2026 - 21:07");
  });

  it("formats date-only values from day to year with hyphen separators", () => {
    expect(formatDateTime("2026-08-14T21:07:00Z", false, "UTC")).toBe("14-08-2026");
  });
});
