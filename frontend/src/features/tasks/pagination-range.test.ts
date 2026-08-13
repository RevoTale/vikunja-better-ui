import { describe, expect, it } from "vitest";

import { paginationRange } from "./pagination-range";

describe("paginationRange", () => {
  it("shows every page when the result set is short", () => {
    expect(paginationRange(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("keeps the first, current, and last pages visible", () => {
    expect(paginationRange(6, 12)).toEqual([1, "start-ellipsis", 6, "end-ellipsis", 12]);
  });

  it("keeps the control compact near either end", () => {
    expect(paginationRange(2, 12)).toEqual([1, 2, 3, "end-ellipsis", 12]);
    expect(paginationRange(11, 12)).toEqual([1, "start-ellipsis", 10, 11, 12]);
  });
});
