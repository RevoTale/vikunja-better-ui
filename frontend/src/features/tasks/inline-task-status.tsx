import { useQuery } from "@apollo/client/react";
import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { SessionDocument } from "@/graphql/graphql";
import type { InlineTask } from "./inline-task-input";
import { TaskActionFeedback } from "./task-action-feedback";
import type { InlineTaskEditing } from "./use-inline-task-editing";
import { useTaskListActions } from "./use-task-list-actions";

export function InlineTaskStatus({
  task,
  disabled,
  onChanged,
  children,
  editor,
}: {
  task: InlineTask;
  disabled: boolean;
  onChanged: () => Promise<unknown>;
  children: React.ReactNode;
  editor: InlineTaskEditing;
}) {
  const session = useQuery(SessionDocument);
  const actions = useTaskListActions(session.data?.session.csrfToken ?? undefined, onChanged);
  const [open, setOpen] = useState(false);
  return (
    <>
      {task.isDone || task.kind === "INVALID" ? (
        children
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            disabled={disabled || Boolean(actions.completingTaskID)}
            aria-label="Change status"
            className="rounded-sm text-left hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {children}
          </PopoverTrigger>
          <PopoverContent align="start">
            <PopoverTitle>Status</PopoverTitle>
            <p className="text-xs text-muted-foreground">
              {task.recurrenceRule
                ? "Complete this occurrence and renew its schedule."
                : "Complete this task. Undo is available briefly."}
            </p>
            <Button
              size="sm"
              disabled={Boolean(actions.completingTaskID) || !session.data?.session.csrfToken}
              onClick={() => {
                setOpen(false);
                void editor.runAction(() => actions.markDone({ ...task, commentCount: null }));
              }}
            >
              <Check /> Complete task
            </Button>
          </PopoverContent>
        </Popover>
      )}
      <TaskActionFeedback actions={actions} />
    </>
  );
}
