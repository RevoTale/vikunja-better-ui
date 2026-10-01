import { useState } from "react";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { Button } from "@/components/ui/button";
import type { TaskRelationKind } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { RelationGroup } from "./relation-group";
import { type RelationRemoval, RelationRemovalDialog } from "./relation-removal";
import { RelationSearch } from "./relation-search";
import { NewSubtask } from "./subtask-composer";
import type { SubtaskParent } from "./subtask-properties";
import { useTaskRelations } from "./use-task-relations";

function relationFailure(error: string, queryError: unknown): string {
  return (
    error ||
    (queryError ? graphQLErrorMessage(queryError, "Relationships could not be loaded.") : "")
  );
}

export function TaskRelationships({ parent }: { parent: SubtaskParent }) {
  const { id: taskId, title } = parent;
  const actions = useTaskRelations(taskId);
  const [adding, setAdding] = useState<TaskRelationKind>();
  const [removal, setRemoval] = useState<RelationRemoval>();
  const result = actions.query.data?.taskRelationships;
  const returnTo = `/tasks/${taskId}`;
  const error = relationFailure(actions.error, actions.query.error);
  return (
    <div className="mt-6 space-y-5 border-t pt-4" aria-busy={actions.query.loading}>
      {error ? (
        <div role="alert" className="text-sm text-destructive">
          {error}
          <Button
            variant="ghost"
            onClick={() => void actions.query.refetch().catch(() => undefined)}
          >
            Refresh relationships
          </Button>
        </div>
      ) : null}
      {!result && actions.query.loading ? (
        <div role="status">
          <span className="sr-only">Loading relationships</span>
          <LoadingPlaceholder className="h-40 w-full" />
        </div>
      ) : null}
      {result ? (
        <>
          {result.parents.length > 1 ? (
            <p role="status" className="text-sm text-destructive">
              Multiple parents were set outside Better UI. Unlink unwanted parents before attaching
              another.
            </p>
          ) : null}
          {result.parents.length > 0 ? (
            <RelationGroup
              title="Parent tasks"
              items={result.parents}
              returnTo={returnTo}
              pending={actions.pending}
              canEdit={result.canEdit}
              onRemove={(task) => setRemoval({ task, kind: "PARENT" })}
            />
          ) : null}
          <RelationGroup
            title="Subtasks"
            items={result.children}
            returnTo={returnTo}
            pending={actions.pending}
            canEdit={result.canEdit}
            onAdd={() => setAdding("SUBTASK")}
            onRemove={(task) => setRemoval({ task, kind: "SUBTASK" })}
          />
          <RelationGroup
            title="Related tasks"
            items={result.related}
            returnTo={returnTo}
            pending={actions.pending}
            canEdit={result.canEdit}
            onAdd={() => setAdding("RELATED")}
            onRemove={(task) => setRemoval({ task, kind: "RELATED" })}
          />
        </>
      ) : null}
      {result?.canEdit ? <NewSubtask parent={parent} /> : null}
      {adding && result ? (
        <RelationSearch
          taskId={taskId}
          excluded={
            new Set(
              (adding === "SUBTASK" ? result.children : result.related).map((task) => task.id),
            )
          }
          pending={actions.pending}
          error={error}
          onClose={() => setAdding(undefined)}
          onSelect={async (otherTaskId) => {
            if (await actions.change({ taskId, otherTaskId, kind: adding, remove: false }))
              setAdding(undefined);
          }}
        />
      ) : null}
      {removal ? (
        <RelationRemovalDialog
          taskId={taskId}
          title={title}
          removal={removal}
          pending={actions.pending}
          error={error}
          change={actions.change}
          onClose={() => setRemoval(undefined)}
        />
      ) : null}
    </div>
  );
}
