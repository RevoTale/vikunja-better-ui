import { ApolloLink, makeVar } from "@apollo/client";
import type { DocumentNode } from "graphql";
import { finalize } from "rxjs";

export const taskCountRevision = makeVar(0);

const countMutations = new Set([
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
]);

export function changesTaskCount(document: DocumentNode): boolean {
  return document.definitions.some(
    (definition) =>
      definition.kind === "OperationDefinition" &&
      definition.operation === "mutation" &&
      definition.selectionSet.selections.some(
        (selection) => selection.kind === "Field" && countMutations.has(selection.name.value),
      ),
  );
}

// A failed response can still follow an upstream write. Recheck on every outcome.
export const taskCountRefreshLink = new ApolloLink((operation, forward) => {
  if (!changesTaskCount(operation.query)) return forward(operation);
  return forward(operation).pipe(finalize(() => taskCountRevision(taskCountRevision() + 1)));
});
