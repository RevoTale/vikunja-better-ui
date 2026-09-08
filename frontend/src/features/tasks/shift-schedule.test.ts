import { describe, expect, it } from "vitest";
import { localInstant, shiftSchedule } from "./shift-schedule";

describe("schedule shifts", () => {
  it.each([60, 120])(
    "rejects a shift into either occurrence of a repeated hour (%i minutes)",
    (minutes) => {
      const fields = { start: "2026-10-25T02:30" };
      expect(() => shiftSchedule(fields, "all", minutes, "Europe/Kyiv")).toThrow(/ambiguous/);
      expect(fields.start).toBe("2026-10-25T02:30");
    },
  );
  it("allows a shift past the repeated hour", () => {
    expect(shiftSchedule({ start: "2026-10-25T02:30" }, "all", 180, "Europe/Kyiv")).toEqual({
      start: "2026-10-25T04:30",
    });
  });
  it("moves across midnight using the user's timezone", () => {
    expect(shiftSchedule({ due: "2026-09-08T23:30" }, "all", 56, "Europe/Kyiv")).toEqual({
      due: "2026-09-09T00:26",
    });
  });
  it("preserves date-only dates for whole days", () => {
    expect(shiftSchedule({ due: "2026-10-25" }, "due", 1440, "Europe/Kyiv")).toEqual({
      due: "2026-10-26",
    });
    expect(shiftSchedule({ due: "2026-09-08" }, "due", 1440, "Europe/Kyiv")).toEqual({
      due: "2026-09-09",
    });
  });
  it("uses elapsed hours across DST and rejects ambiguous input", () => {
    expect(shiftSchedule({ start: "2026-03-29T02:30" }, "all", 60, "Europe/Kyiv")).toEqual({
      start: "2026-03-29T04:30",
    });
    expect(() => localInstant("2026-03-29T03:30", "Europe/Kyiv")).toThrow();
    expect(() => localInstant("2026-10-25T03:30", "Europe/Kyiv")).toThrow();
  });
  it("only changes the selected field and preserves missing dates", () => {
    const fields = { start: "2026-09-08T08:00", end: "2026-09-08T12:00", due: "" };
    expect(shiftSchedule(fields, "end", -60, "UTC")).toEqual({
      ...fields,
      end: "2026-09-08T11:00",
    });
  });
});
