import { describe, expect, it } from "vitest";
import { rhythmFrequency } from "./recurring-rhythm";

describe("habit frequency comparisons", () => {
  const daily = { interval: 1, unit: "DAY", mode: "SCHEDULED_CYCLE", keepDueTime: false } as const;
  it("shows daily and fortnightly rhythms over a week", () => {
    expect(rhythmFrequency(daily, "WEEK")).toBe("7× / week");
    expect(rhythmFrequency({ ...daily, interval: 2, unit: "WEEK" }, "WEEK")).toBe(
      "Less than once / week",
    );
  });
  it("preserves calendar month ratios and marks average conversions", () => {
    expect(rhythmFrequency({ ...daily, unit: "MONTH" }, "YEAR")).toBe("12× / year");
    expect(rhythmFrequency(daily, "MONTH")).toBe("≈ 30.4× / month");
    expect(rhythmFrequency({ ...daily, unit: "WEEK" }, "YEAR")).toBe("≈ 52.2× / year");
  });
  it("does not invent a rhythm for missing or invalid rules", () => {
    expect(rhythmFrequency(null, "WEEK")).toBe("Frequency unavailable");
    expect(rhythmFrequency({ ...daily, interval: 0 }, "WEEK")).toBe("Frequency unavailable");
  });
});
