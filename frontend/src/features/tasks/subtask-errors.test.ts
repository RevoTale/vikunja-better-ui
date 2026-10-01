import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { describe, expect, it } from "vitest";
import { subtaskCreationUncertain } from "./subtask-errors";

describe("subtask retry safety", () => {
  it.each(["VALIDATION_FAILED", "FORBIDDEN", "UNAUTHENTICATED", "CSRF_INVALID"])(
    "keeps a %s draft editable",
    (code) => {
      const error = new CombinedGraphQLErrors({
        errors: [{ message: "Rejected", extensions: { code } }],
      });
      expect(subtaskCreationUncertain(error)).toBe(false);
    },
  );
  it("requires checking the task list after an uncertain write", () => {
    expect(subtaskCreationUncertain(new Error("Network failure"))).toBe(true);
    const error = new CombinedGraphQLErrors({
      errors: [{ message: "Unknown", extensions: { code: "UPSTREAM_UNAVAILABLE" } }],
    });
    expect(subtaskCreationUncertain(error)).toBe(true);
  });
});
