import { describe, expect, it } from "vitest";

import { apolloClient } from "./apollo";

describe("apolloClient", () => {
  it("refreshes watched data unless a query explicitly opts out", () => {
    expect(apolloClient.defaultOptions.watchQuery?.fetchPolicy).toBe("cache-and-network");
  });
});
