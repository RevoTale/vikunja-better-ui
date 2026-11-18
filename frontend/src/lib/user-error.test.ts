import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { describe, expect, it } from "vitest";

import { graphQLErrorMessage, mutationOutcomeUncertain } from "./user-error";

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

describe("mutation retry safety", () => {
  it.each(["VALIDATION_FAILED", "FORBIDDEN", "UNAUTHENTICATED", "CSRF_INVALID"])(
    "keeps a %s draft editable",
    (code) => {
      const error = new CombinedGraphQLErrors({
        errors: [{ message: "Rejected", extensions: { code } }],
      });
      expect(mutationOutcomeUncertain(error)).toBe(false);
    },
  );
  it("requires checking the result after an uncertain write", () => {
    expect(mutationOutcomeUncertain(new Error("Network failure"))).toBe(true);
    const error = new CombinedGraphQLErrors({
      errors: [{ message: "Unknown", extensions: { code: "UPSTREAM_UNAVAILABLE" } }],
    });
    expect(mutationOutcomeUncertain(error)).toBe(true);
  });
});
