import { Link } from "@tanstack/react-router";
import { Pencil, SkipForward } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { TaskDetailsQuery } from "@/graphql/graphql";
import { cn } from "@/lib/utils";
import { taskDetailActionPolicy } from "./task-detail-action-policy";
import { TaskDetailMore } from "./task-detail-more";
import { useTaskDetailActions } from "./use-task-detail-actions";

type TaskDetail = NonNullable<TaskDetailsQuery["task"]>;

export function TaskDetailActions({
  task,
  returnTo,
  onChanged,
  runAction,
}: {
  task: TaskDetail;
  returnTo: string;
  onChanged: () => Promise<unknown>;
  runAction: (action: () => Promise<void>) => Promise<void>;
}) {
  const policy = taskDetailActionPolicy(task);
  const { pending, actionPending, repairCapability, notice, error, skipOccurrence, repairHistory } =
    useTaskDetailActions(task, onChanged);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Task actions</legend>
        {!task.isDone && !pending ? (
          <Link
            to="/tasks/$taskId/edit"
            params={{ taskId: task.id }}
            search={{ returnTo }}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11")}
          >
            <Pencil aria-hidden="true" /> Edit
          </Link>
        ) : null}
        {policy.canSkip ? (
          <Button
            size="sm"
            variant="ghost"
            className="min-h-11"
            disabled={pending}
            onClick={() => void runAction(skipOccurrence)}
          >
            <SkipForward /> {actionPending === "skip" ? "Skipping…" : "Skip"}
          </Button>
        ) : null}
        <TaskDetailMore
          taskId={task.id}
          returnTo={returnTo}
          canDelete={policy.canDelete}
          pending={pending}
        />
      </fieldset>
      {notice ? (
        <p className="max-w-md text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="max-w-md text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {repairCapability ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => void runAction(repairHistory)}
        >
          {actionPending === "repair" ? "Repairing…" : "Repair recurring task"}
        </Button>
      ) : null}
    </div>
  );
}
