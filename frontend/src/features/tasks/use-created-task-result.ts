import { useMutation } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { RepairTaskMetadataDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import type { CreatePayload } from "./use-create-task-mutation";

export type CreationRepair = { capability: string; taskId: string; steps: readonly string[] };
export type CreationLabelWarning = { taskId: string; message: string };

export function useCreatedTaskResult(csrfToken: string | null | undefined, returnTo: string) {
  const navigate = useNavigate();
  const [repair, repairState] = useMutation(RepairTaskMetadataDocument);
  const [error, setError] = useState("");
  const [labelWarning, setLabelWarning] = useState<CreationLabelWarning>();
  const [repairInfo, setRepairInfo] = useState<CreationRepair>();

  async function openTask(taskId: string, message: string) {
    try {
      await navigate({ to: "/tasks/$taskId", params: { taskId }, search: { returnTo } });
    } catch {
      setError(message);
    }
  }

  async function acceptCreated(payload: CreatePayload) {
    if (payload.labelError)
      setLabelWarning({ taskId: payload.task.id, message: payload.labelError });
    if (payload.status === "REPAIR_REQUIRED" && payload.repairCapability) {
      setRepairInfo({
        capability: payload.repairCapability,
        taskId: payload.task.id,
        steps: payload.remainingRepairSteps,
      });
      return;
    }
    if (payload.labelError) return;
    await openTask(
      payload.task.id,
      "The task was created, but its page could not be opened. Return to the task list.",
    );
  }

  async function continueRepair() {
    if (!csrfToken || !repairInfo) return;
    try {
      const payload = (
        await repair({ variables: { input: { csrfToken, capability: repairInfo.capability } } })
      ).data?.repairTaskMetadata;
      if (!payload) throw new Error("empty result");
      if (payload.status === "REPAIR_REQUIRED" && payload.repairCapability) {
        setRepairInfo({
          capability: payload.repairCapability,
          taskId: payload.task.id,
          steps: payload.remainingRepairSteps,
        });
        return;
      }
      if (labelWarning) {
        setRepairInfo(undefined);
        return;
      }
      await openTask(
        payload.task.id,
        "Metadata repair finished, but the task page could not be opened. Return to the task list.",
      );
    } catch (caught) {
      setError(
        graphQLErrorMessage(
          caught,
          "Metadata repair did not finish. You can safely retry this repair; the task will not be created again.",
        ),
      );
    }
  }

  return {
    error,
    setError,
    labelWarning,
    repairInfo,
    repairing: repairState.loading,
    acceptCreated,
    continueRepair,
  };
}
