import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { describe, expect, it } from "vitest";

import { graphQLErrorMessage } from "./user-error";

describe("graphQLErrorMessage", () => {
  it("returns the safe message supplied by the GraphQL API", () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: "Vikunja is unavailable. Try again shortly.",
          extensions: { code: "UPSTREAM_UNAVAILABLE" },
        },
      ],
    });

    expect(graphQLErrorMessage(error, "The username or password is incorrect.")).toBe(
      "Vikunja is unavailable. Try again shortly.",
    );
  });

  it("uses the contextual fallback for errors not returned by GraphQL", () => {
    expect(graphQLErrorMessage(new Error("fetch failed at internal host"), "Request failed.")).toBe(
      "Request failed.",
    );
  });
});
