import { useMutation } from "@apollo/client/react";
import { useEffect, useState } from "react";
import { RepairTaskMetadataDocument, UndoTaskCompletionDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import type { TaskRecovery } from "./completion-feedback";
export function useTaskRecovery(
  csrfToken: string | undefined,
  refreshAfter: (message: string) => Promise<void>,
  setNotice: (message: string) => void,
) {
  const [undo, setUndo] = useState<TaskRecovery>();
  const [repairInfo, setRepairInfo] = useState<TaskRecovery>();
  const [undoCompletion, { loading: undoing }] = useMutation(UndoTaskCompletionDocument);
  const [repair, { loading: repairing }] = useMutation(RepairTaskMetadataDocument);
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(undefined), 8_000);
    return () => window.clearTimeout(timer);
  }, [undo]);

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

  return { undo, setUndo, repairInfo, setRepairInfo, undoing, repairing, restore, repairHistory };
}
