import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { useState } from "react";
import {
  RepairTaskMetadataDocument,
  SessionDocument,
  type TaskDetailsQuery,
  TaskListDocument,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { useSkipRequest } from "./use-skip-request";

export function useTaskDetailActions(
  task: NonNullable<TaskDetailsQuery["task"]>,
  onChanged: () => Promise<unknown>,
) {
  const client = useApolloClient();
  const { data: sessionData, error: sessionError } = useQuery(SessionDocument);
  const [repair] = useMutation(RepairTaskMetadataDocument);
  const [repairCapability, setRepairCapability] = useState<string>();
  const [actionPending, setActionPending] = useState<"repair" | "skip">();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const skip = useSkipRequest(onChanged, setError);
  const pending = actionPending !== undefined;

  async function refreshAffectedTasks(fallback: string) {
    try {
      await onChanged();
      await client.refetchQueries({ include: [TaskListDocument] });
    } catch (caught) {
      setError(graphQLErrorMessage(caught, fallback));
    }
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
      const payload = await skip({ csrfToken, taskId: task.id, expectedDueAt: task.dueAt });
      if (!payload) return;
      setRepairCapability(payload.repairCapability ?? undefined);
      setNotice(
        payload.status === "CONFIRMED_REPAIR_REQUIRED"
          ? "This occurrence was skipped and renewed. Its due time or History still needs repair."
          : "This occurrence was skipped and the next one is ready.",
      );
      await refreshAffectedTasks(
        "The occurrence was skipped, but refreshed task data could not be loaded.",
      );
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
      await refreshAffectedTasks(
        "The recurring task was repaired, but refreshed task data could not be loaded.",
      );
    } finally {
      setActionPending(undefined);
    }
  }

  return { pending, actionPending, repairCapability, notice, error, skipOccurrence, repairHistory };
}
