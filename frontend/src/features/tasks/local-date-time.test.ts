import { describe, expect, it } from "vitest";

import { composeLocalDateTime, currentDateInTimeZone } from "./local-date-time";

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

  it("derives the current date from the authoritative timezone", () => {
    const instant = new Date("2026-08-13T21:30:00Z");

    expect(currentDateInTimeZone("Europe/Kyiv", instant)).toBe("2026-08-14");
    expect(currentDateInTimeZone("Pacific/Honolulu", instant)).toBe("2026-08-13");
  });

  it("rejects an invalid authoritative timezone without throwing during render", () => {
    expect(currentDateInTimeZone("Invalid/Timezone")).toBeUndefined();
  });
});
