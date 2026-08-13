import { describe, expect, it } from "vitest";

import { apolloClient } from "./apollo";

describe("apolloClient", () => {
  it("uses cached query data while refreshing it from the network", () => {
    expect(apolloClient.defaultOptions.watchQuery?.fetchPolicy).toBe("cache-and-network");
  });
});
