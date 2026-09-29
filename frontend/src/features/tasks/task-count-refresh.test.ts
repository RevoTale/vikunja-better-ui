import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { parse } from "graphql";
import { of, throwError } from "rxjs";
import { describe, expect, it } from "vitest";
import { changesTaskCount, taskCountRefreshLink, taskCountRevision } from "./task-count-refresh";

describe("task count mutation refresh", () => {
  it.each([
    "createOneTimeTask",
    "createRecurringTask",
    "createJob",
    "updateTask",
    "deleteTask",
    "completeTask",
    "undoTaskCompletion",
    "skipRecurringTask",
    "repairTaskMetadata",
    "setRecurringKeepDueTime",
  ])("invalidates %s even with an alias", (field) => {
    expect(changesTaskCount(parse(`mutation { result: ${field} { __typename } }`))).toBe(true);
  });

  it("does not refresh for unrelated operations", () => {
    expect(changesTaskCount(parse("mutation { createTaskComment { id } }"))).toBe(false);
    expect(changesTaskCount(parse("query { actionableTaskCount }"))).toBe(false);
  });

  it.each(["success", "graphql-error", "transport-error"])(
    "invalidates after %s",
    async (outcome) => {
      const before = taskCountRevision();
      const terminal = new ApolloLink(() =>
        outcome === "transport-error"
          ? throwError(() => new Error("network failed"))
          : of(
              outcome === "graphql-error"
                ? { data: null, errors: [{ message: "Uncertain write" }] }
                : { data: { completeTask: { __typename: "CompletionResult" } } },
            ),
      );
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: taskCountRefreshLink.concat(terminal),
      });
      await client
        .mutate({ mutation: parse("mutation { completeTask { __typename } }") })
        .catch(() => undefined);
      expect(taskCountRevision()).toBe(before + 1);
      client.stop();
    },
  );
});
