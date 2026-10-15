import { describe, expect, it } from "vitest";

import { parseListSearch } from "./list-search";

describe("parseListSearch", () => {
  it.each(["UNSET", "LOW", "MEDIUM", "HIGH", "URGENT", "DO_NOW"])(
    "preserves the exact priority %s independently of project and label IDs",
    (priority) => {
      expect(parseListSearch({ project: 7, label: 9, priority, page: 3 })).toEqual({
        project: "7",
        label: "9",
        priority,
        page: 3,
      });
    },
  );
  it.each(["all", "", "high", "0", 0, 5, "INVALID", ["HIGH"]])(
    "ignores invalid or unfiltered priority %o",
    (priority) => expect(parseListSearch({ priority })).toEqual({ project: "all", page: 1 }),
  );
  it("keeps label IDs distinct from project IDs", () => {
    expect(parseListSearch({ project: 7, label: 9, page: 2 })).toEqual({
      project: "7",
      label: "9",
      page: 2,
    });
    expect(parseListSearch({ label: "job" })).toEqual({ project: "all", page: 1 });
  });
  it.each([{}, { project: "all", page: 1 }, { project: "7", page: "2" }, { project: 7 }])(
    "normalizes %o",
    (input) => {
      const result = parseListSearch(input);
      expect(result.page).toBeGreaterThan(0);
      expect(result.project === "all" || /^[1-9]\d*$/.test(result.project)).toBe(true);
    },
  );

  it("preserves a numeric project ID produced by the router search parser", () => {
    expect(parseListSearch({ project: 7, page: 2 })).toEqual({ project: "7", page: 2 });
  });

  it.each([{ project: "0" }, { project: "-2" }, { page: 0 }, { page: "no" }, { page: 1.2 }])(
    "rejects invalid values in %o",
    (input) => expect(parseListSearch(input)).toEqual({ project: "all", page: 1 }),
  );
});
