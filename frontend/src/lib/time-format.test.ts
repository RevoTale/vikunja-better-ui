import { describe, expect, it } from "vitest";
import { displayTime, displayTimestamp, inputTime, parseTime } from "./time-format";

describe("configured clock format", () => {
  it("defaults to 24 hours and keeps midnight as 00:00", () => {
    expect(displayTime(new Date("2026-10-09T00:00:00Z"), "UTC")).toBe("00:00");
    expect(displayTime(new Date("2026-10-09T21:07:00Z"), "UTC")).toBe("21:07");
  });
  it("supports AM/PM without changing absolute instants or canonical values", () => {
    expect(displayTimestamp("2026-10-09T21:07:03Z", true, "UTC")).toContain("09:07:03 PM");
    expect(displayTimestamp("2026-10-09T21:07:03Z", false, "UTC")).toContain("21:07:03");
    expect(displayTime(new Date("2026-10-09T00:00:00Z"), "UTC", true)).toBe("12:00 AM");
    expect(displayTime(new Date("2026-10-09T12:00:00Z"), "UTC", true)).toBe("12:00 PM");
    expect(displayTime(new Date("2026-10-09T21:07:00Z"), "UTC", true)).toBe("09:07 PM");
    expect(inputTime("23:07", true)).toBe("11:07");
    expect(parseTime("12:00", true, "AM")).toBe("00:00");
    expect(parseTime("12:00", true, "PM")).toBe("12:00");
    expect(parseTime("11:07", true, "PM")).toBe("23:07");
  });
  it("accepts numeric mobile input and rejects impossible or partial times", () => {
    expect(parseTime("2107", false, "AM")).toBe("21:07");
    for (const value of ["24:00", "21:60", "2", "21:0"])
      expect(parseTime(value, false, "AM")).toBeNull();
    expect(parseTime("13:00", true, "AM")).toBeNull();
  });
});
