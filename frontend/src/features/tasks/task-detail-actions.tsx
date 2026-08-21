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
import { graphQLErrorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
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
  const { data: sessionData, error: sessionError } = useQuery(SessionDocument);
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
      setError(
        graphQLErrorMessage(
          sessionError,
          "Refresh the page and sign in again before trying again.",
        ),
      );
      return;
    }
    if (!task.dueAt) {
      setError("This recurring occurrence has no due date. Refresh the task before trying again.");
      return;
    }
    setActionPending("skip");
    try {
      let payload: SkipRecurringTaskMutation["skipRecurringTask"] | undefined;
      try {
        payload = (
          await skip({
            variables: { input: { csrfToken, taskId: task.id, expectedDueAt: task.dueAt } },
          })
        ).data?.skipRecurringTask;
      } catch (caught) {
        setError(
          graphQLErrorMessage(
            caught,
            "Skip could not be confirmed. The task was refreshed before you try again.",
          ),
        );
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
          ? "This occurrence was skipped and renewed. Its due time or History still needs repair."
          : "This occurrence was skipped and the next one is ready.",
      );
      try {
        await refreshAffectedTasks();
      } catch (caught) {
        setError(
          graphQLErrorMessage(
            caught,
            "The occurrence was skipped, but refreshed task data could not be loaded.",
          ),
        );
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
        const result = await repair({
          variables: { input: { csrfToken, capability: repairCapability } },
        });
        if (!result.data?.repairTaskMetadata) {
          setError(
            "Recurring task repair could not be confirmed. Refresh the task before trying again.",
          );
          return;
        }
      } catch (caught) {
        setError(
          graphQLErrorMessage(
            caught,
            "Recurring task repair did not finish. Retrying will not renew the task again.",
          ),
        );
        return;
      }
      setRepairCapability(undefined);
      setNotice("The renewed task and skipped History entry were repaired.");
      try {
        await refreshAffectedTasks();
      } catch (caught) {
        setError(
          graphQLErrorMessage(
            caught,
            "The recurring task was repaired, but refreshed task data could not be loaded.",
          ),
        );
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
              buttonVariants({ variant: "destructive", size: "sm" }),
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
