import { describe, expect, it } from "vitest";
import { durationDisplay, durationMinutes } from "./duration-value";

describe("duration values", () => {
  it("converts hours and days without losing minutes", () => {
    expect(durationMinutes("4", "hours")).toBe("240");
    expect(durationMinutes("1.5", "hours")).toBe("90");
    expect(durationMinutes("2", "days")).toBe("2880");
    expect(durationMinutes("56", "minutes")).toBe("56");
    expect(durationDisplay("240")).toEqual({ amount: "4", unit: "hours" });
    expect(durationDisplay("56")).toEqual({ amount: "56", unit: "minutes" });
  });
  it("rejects empty, fractional minutes, negative and overflowing values", () => {
    for (const value of ["", "0", "-1", "Infinity", "0.5", "2147483648"]) {
      expect(durationMinutes(value, "minutes")).toBe("");
    }
    expect(durationMinutes("0.001", "hours")).toBe("");
  });
});
