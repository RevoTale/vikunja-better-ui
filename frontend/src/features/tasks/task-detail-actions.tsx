import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { Bug, SkipForward, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  RepairTaskMetadataDocument,
  SessionDocument,
  SkipRecurringTaskDocument,
  type SkipRecurringTaskMutation,
  type TaskDetailsQuery,
  TaskListDocument,
} from "@/graphql/graphql";
import { cn } from "@/lib/cn";
import { taskDetailActionPolicy } from "./task-detail-action-policy";

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
  const client = useApolloClient();
  const { data: sessionData } = useQuery(SessionDocument);
  const [skip] = useMutation(SkipRecurringTaskDocument);
  const [repair] = useMutation(RepairTaskMetadataDocument);
  const [repairCapability, setRepairCapability] = useState<string>();
  const [actionPending, setActionPending] = useState<"repair" | "skip">();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const policy = taskDetailActionPolicy(task);
  const pending = actionPending !== undefined;

  async function refreshAffectedTasks() {
    await onChanged();
    await client.refetchQueries({ include: [TaskListDocument] });
  }

  async function skipOccurrence() {
    setError("");
    setNotice("");
    const csrfToken = sessionData?.session.csrfToken;
    if (!csrfToken) {
      setError("Refresh the page before trying again.");
      return;
    }
    setActionPending("skip");
    try {
      let payload: SkipRecurringTaskMutation["skipRecurringTask"] | undefined;
      try {
        payload = (await skip({ variables: { input: { csrfToken, taskId: task.id } } })).data
          ?.skipRecurringTask;
      } catch {
        setError("Skip could not be confirmed. The task was refreshed before you try again.");
        await onChanged().catch(() => undefined);
        return;
      }
      if (!payload) {
        setError("The Skip response was incomplete. Reload the page before taking another action.");
        await onChanged().catch(() => undefined);
        return;
      }
      setRepairCapability(payload.repairCapability ?? undefined);
      setNotice(
        payload.status === "CONFIRMED_REPAIR_REQUIRED"
          ? "This occurrence was skipped and renewed. Its history entry still needs repair."
          : "This occurrence was skipped and the next one is ready.",
      );
      try {
        await refreshAffectedTasks();
      } catch {
        setError("The occurrence was skipped, but refreshed task data could not be loaded.");
      }
    } finally {
      setActionPending(undefined);
    }
  }

  async function repairHistory() {
    const csrfToken = sessionData?.session.csrfToken;
    if (!csrfToken || !repairCapability) return;
    setError("");
    setActionPending("repair");
    try {
      try {
        await repair({ variables: { input: { csrfToken, capability: repairCapability } } });
      } catch {
        setError("History repair did not finish. Retrying will not renew the task again.");
        return;
      }
      setRepairCapability(undefined);
      setNotice("The skipped history entry was repaired.");
      try {
        await refreshAffectedTasks();
      } catch {
        setError("The history entry was repaired, but refreshed task data could not be loaded.");
      }
    } finally {
      setActionPending(undefined);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Task actions</legend>
        <Link
          to="/tasks/$taskId/extended"
          params={{ taskId: task.id }}
          search={{ returnTo }}
          className={cn(buttonVariants({ variant: "outline", size: "compact" }))}
        >
          <Bug /> Extended
        </Link>
        {policy.canSkip ? (
          <Button size="compact" variant="outline" disabled={pending} onClick={skipOccurrence}>
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
              buttonVariants({ variant: "destructive", size: "compact" }),
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
        <Button size="compact" variant="outline" disabled={pending} onClick={repairHistory}>
          {actionPending === "repair" ? "Repairing…" : "Repair skipped history"}
        </Button>
      ) : null}
    </div>
  );
}
