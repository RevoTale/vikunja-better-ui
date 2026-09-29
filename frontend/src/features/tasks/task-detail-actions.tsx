import { Link } from "@tanstack/react-router";
import { Bug, SkipForward, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { TaskDetailsQuery } from "@/graphql/graphql";
import { cn } from "@/lib/utils";
import { taskDetailActionPolicy } from "./task-detail-action-policy";
import { useTaskDetailActions } from "./use-task-detail-actions";

type TaskDetail = NonNullable<TaskDetailsQuery["task"]>;

export function TaskDetailActions({
  task,
  returnTo,
  onChanged,
}: {
  task: TaskDetail;
  returnTo: string;
  onChanged: () => Promise<unknown>;
}) {
  const policy = taskDetailActionPolicy(task);
  const { pending, actionPending, repairCapability, notice, error, skipOccurrence, repairHistory } =
    useTaskDetailActions(task, onChanged);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Task actions</legend>
        <Link
          to="/tasks/$taskId/discussion"
          params={{ taskId: task.id }}
          search={{ returnTo }}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Discussion
        </Link>
        {!task.isDone && !pending ? (
          <Link
            to="/tasks/$taskId/edit"
            params={{ taskId: task.id }}
            search={{ returnTo }}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Edit
          </Link>
        ) : null}
        <Link
          to="/tasks/$taskId/extended"
          params={{ taskId: task.id }}
          search={{ returnTo }}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Bug /> Extended
        </Link>
        {policy.canSkip ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={skipOccurrence}>
            <SkipForward /> {actionPending === "skip" ? "Skipping…" : "Skip"}
          </Button>
        ) : null}
        {policy.canDelete ? (
          <Link
            to="/tasks/$taskId/delete"
            params={{ taskId: task.id }}
            search={{ returnTo }}
            aria-disabled={pending}
            tabIndex={pending ? -1 : 0}
            onClick={(event) => {
              if (pending) event.preventDefault();
            }}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              pending && "pointer-events-none opacity-50",
            )}
          >
            <Trash2 /> Delete
          </Link>
        ) : null}
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
        <Button size="sm" variant="outline" disabled={pending} onClick={repairHistory}>
          {actionPending === "repair" ? "Repairing…" : "Repair recurring task"}
        </Button>
      ) : null}
    </div>
  );
}
