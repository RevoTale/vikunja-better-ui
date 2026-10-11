import { useQuery } from "@apollo/client/react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionDocument } from "@/graphql/graphql";
import type { InlineTask } from "./inline-task-input";
import { TaskActionFeedback } from "./task-action-feedback";
import type { InlineTaskEditing } from "./use-inline-task-editing";
import { useTaskListActions } from "./use-task-list-actions";

export function TaskDetailCompletion({
  task,
  editor,
  onChanged,
}: {
  task: InlineTask;
  editor: InlineTaskEditing;
  onChanged: () => Promise<unknown>;
}) {
  const session = useQuery(SessionDocument);
  const actions = useTaskListActions(session.data?.session.csrfToken ?? undefined, onChanged);
  const disabled =
    editor.active !== null ||
    editor.pending ||
    editor.blocked ||
    Boolean(actions.completingTaskID) ||
    !session.data?.session.csrfToken;
  return (
    <fieldset
      disabled={editor.active !== null || editor.pending || editor.blocked}
      className="min-w-0 space-y-2"
    >
      <legend className="sr-only">Task completion</legend>
      {!task.isDone && task.kind !== "INVALID" ? (
        <Button
          disabled={disabled}
          className="min-h-11"
          aria-label={task.recurrenceRule ? "Complete occurrence" : "Complete task"}
          title={
            task.recurrenceRule
              ? "Complete this occurrence and renew its schedule"
              : "Complete this task"
          }
          onClick={() =>
            void editor.runAction(() => actions.markDone({ ...task, commentCount: null }))
          }
        >
          <Check aria-hidden="true" />
          {actions.completingTaskID ? "Completing…" : "Complete"}
        </Button>
      ) : null}
      <TaskActionFeedback
        actions={{
          ...actions,
          restore: () => editor.runAction(actions.restore),
          repairHistory: () => editor.runAction(actions.repairHistory),
        }}
      />
    </fieldset>
  );
}
