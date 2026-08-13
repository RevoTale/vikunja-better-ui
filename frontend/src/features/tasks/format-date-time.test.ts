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

  it("formats an instant in the explicit Vikunja timezone", () => {
    const instant = "2026-08-13T21:30:00Z";

    expect(formatDateTime(instant, true, "Europe/Kyiv")).toBe("14-08-2026 - 00:30");
    expect(formatDateTime(instant, true, "Pacific/Honolulu")).toBe("13-08-2026 - 11:30");
  });
});
