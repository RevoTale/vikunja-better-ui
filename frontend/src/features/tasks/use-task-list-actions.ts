import { useMutation } from "@apollo/client/react";
import { useEffect, useState } from "react";

import {
  CompleteTaskDocument,
  RepairTaskMetadataDocument,
  UndoTaskCompletionDocument,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import type { TaskItem } from "./task-row";

type UndoState = { capability: string; title: string };
type RepairState = { capability: string; title: string };

export function useTaskListActions(csrfToken: string | undefined, refetch: () => Promise<unknown>) {
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<UndoState>();
  const [repairInfo, setRepairInfo] = useState<RepairState>();
  const [completingTaskID, setCompletingTaskID] = useState<string>();
  const [complete] = useMutation(CompleteTaskDocument);
  const [undoCompletion, { loading: undoing }] = useMutation(UndoTaskCompletionDocument);
  const [repair, { loading: repairing }] = useMutation(RepairTaskMetadataDocument);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(undefined), 8_000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  async function refreshAfter(message: string): Promise<void> {
    setNotice(message);
    try {
      await refetch();
    } catch (caught) {
      setNotice(
        `${message} ${graphQLErrorMessage(caught, "Refreshed task data could not be loaded.")}`,
      );
    }
  }

  async function markDone(task: TaskItem): Promise<void> {
    setNotice("");
    setCompletingTaskID(task.id);
    try {
      if (!csrfToken) throw new Error("missing session");
      const result = await complete({
        variables: {
          input: {
            csrfToken,
            taskId: task.id,
            expectedKind: task.kind,
            expectedRecurring: task.recurrenceRule !== null,
            expectedDueAt: task.recurrenceRule ? task.dueAt : null,
          },
        },
      });
      const payload = result.data?.completeTask;
      if (!payload) {
        setNotice("Completion could not be confirmed. Refresh the task before trying again.");
        await refetch().catch(() => undefined);
        return;
      }

      let completionNotice: string;
      if (payload.status === "CONFIRMED_REPAIR_REQUIRED") {
        completionNotice =
          "The recurring task renewed, but its due time or History still needs repair.";
        if (payload.repairCapability) {
          setRepairInfo({ capability: payload.repairCapability, title: task.title });
        }
      } else if (task.recurrenceRule) {
        completionNotice = "Recurring task completed and renewed.";
      } else {
        completionNotice = `${task.title} completed.`;
        if (payload.undoCapability) {
          setUndo({ capability: payload.undoCapability, title: task.title });
        }
      }
      await refreshAfter(completionNotice);
    } catch (caught) {
      setNotice(
        graphQLErrorMessage(
          caught,
          "Completion failed. The task was refreshed so you can safely try again.",
        ),
      );
      await refetch().catch(() => undefined);
    } finally {
      setCompletingTaskID(undefined);
    }
  }

  async function restore(): Promise<void> {
    if (!undo) return;
    try {
      if (!csrfToken) throw new Error("missing session");
      const result = await undoCompletion({
        variables: { input: { csrfToken, capability: undo.capability } },
      });
      if (!result.data?.undoTaskCompletion) {
        setNotice("Undo could not be confirmed. Refresh the task before trying again.");
        return;
      }
      const restoredTitle = undo.title;
      setUndo(undefined);
      await refreshAfter(`${restoredTitle} restored.`);
    } catch (caught) {
      setNotice(
        graphQLErrorMessage(
          caught,
          "Undo could not be applied because the task changed or the Undo window expired.",
        ),
      );
    }
  }

  async function repairHistory(): Promise<void> {
    if (!repairInfo) return;
    try {
      if (!csrfToken) throw new Error("missing session");
      const result = await repair({
        variables: { input: { csrfToken, capability: repairInfo.capability } },
      });
      if (!result.data?.repairTaskMetadata) {
        setNotice(
          "Recurring task repair could not be confirmed. Refresh the task before trying again.",
        );
        return;
      }
      const repairedTitle = repairInfo.title;
      setRepairInfo(undefined);
      await refreshAfter(`${repairedTitle} history repaired.`);
    } catch (caught) {
      setNotice(
        graphQLErrorMessage(
          caught,
          "Recurring task repair did not finish. It is safe to retry; the task will not renew again.",
        ),
      );
    }
  }

  return {
    completingTaskID,
    markDone,
    notice,
    repairHistory,
    repairInfo,
    repairing,
    restore,
    undo,
    undoing,
  };
}
