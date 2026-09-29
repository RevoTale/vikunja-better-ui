import { useMutation } from "@apollo/client/react";
import { useState } from "react";

import { CompleteTaskDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { completionFeedback } from "./completion-feedback";
import type { TaskItem } from "./task-row";
import { useTaskRecovery } from "./use-task-recovery";

export function useTaskListActions(csrfToken: string | undefined, refetch: () => Promise<unknown>) {
  const [notice, setNotice] = useState("");
  const [completingTaskID, setCompletingTaskID] = useState<string>();
  const [complete] = useMutation(CompleteTaskDocument);

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

  const recovery = useTaskRecovery(csrfToken, refreshAfter, setNotice);

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

      const feedback = completionFeedback(task, payload);
      if (feedback.repair) recovery.setRepairInfo(feedback.repair);
      if (feedback.undo) recovery.setUndo(feedback.undo);
      await refreshAfter(feedback.notice);
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

  return {
    completingTaskID,
    markDone,
    notice,
    undo: recovery.undo,
    repairInfo: recovery.repairInfo,
    undoing: recovery.undoing,
    repairing: recovery.repairing,
    restore: recovery.restore,
    repairHistory: recovery.repairHistory,
  };
}
