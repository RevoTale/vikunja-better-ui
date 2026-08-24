import { describe, expect, it } from "vitest";

import { parseWeekSearch, shiftLocalDate } from "./week-search";

describe("parseWeekSearch", () => {
  it("keeps a valid absolute week date and project", () => {
    expect(parseWeekSearch({ week: "2026-08-24", project: "7" })).toEqual({
      week: "2026-08-24",
      project: "7",
    });
  });

  it("drops impossible or malformed dates", () => {
    expect(parseWeekSearch({ week: "2026-02-30" })).toEqual({ project: "all" });
    expect(parseWeekSearch({ week: "next" })).toEqual({ project: "all" });
  });
});

describe("shiftLocalDate", () => {
  it("moves between weeks without depending on the browser timezone", () => {
    expect(shiftLocalDate("2026-12-28", 7)).toBe("2027-01-04");
    expect(shiftLocalDate("2026-01-05", -7)).toBe("2025-12-29");
  });
});
