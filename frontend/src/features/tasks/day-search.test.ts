import { describe, expect, it } from "vitest";
import { navigateDaySearch, parseDaySearch } from "./day-search";

describe("daily navigation search", () => {
  it("uses the click-time calendar day across midnight and DST", () => {
    const search = { project: "4", label: "7", page: 3 };
    expect(navigateDaySearch(search, "Europe/Kyiv", 1, new Date("2026-10-24T21:30:00Z"))).toEqual({
      project: "4",
      label: "7",
      page: 1,
      date: "2026-10-26",
    });
    expect(
      navigateDaySearch(
        { ...search, date: "2026-10-26" },
        "Europe/Kyiv",
        -1,
        new Date("2026-10-24T21:30:00Z"),
      ),
    ).toEqual({ ...search, page: 1 });
    expect(navigateDaySearch(search, undefined, 1)).toBeUndefined();
    expect(navigateDaySearch({ ...search, date: "2026-10-26" }, undefined, null)).toEqual({
      ...search,
      page: 1,
    });
  });
  it("preserves real dates, project, labels and pagination", () => {
    expect(parseDaySearch({ date: "2026-10-25", project: "4", label: "7", page: 2 })).toEqual({
      date: "2026-10-25",
      project: "4",
      label: "7",
      page: 2,
    });
  });
  it.each(["2026-02-30", "tomorrow", 5, undefined])("ignores invalid date %s", (date) => {
    expect(parseDaySearch({ date })).toEqual({ project: "all", page: 1 });
  });
});
