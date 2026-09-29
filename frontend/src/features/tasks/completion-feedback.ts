import type { CompleteTaskMutation } from "@/graphql/graphql";
import type { TaskItem } from "./task-row";

export type TaskRecovery = { capability: string; title: string };

export function completionFeedback(
  task: Pick<TaskItem, "title" | "recurrenceRule">,
  payload: Pick<
    CompleteTaskMutation["completeTask"],
    "status" | "repairCapability" | "undoCapability"
  >,
): {
  notice: string;
  repair?: TaskRecovery;
  undo?: TaskRecovery;
} {
  if (payload.status === "CONFIRMED_REPAIR_REQUIRED") {
    return {
      notice: "The recurring task renewed, but its due time or History still needs repair.",
      ...(payload.repairCapability
        ? { repair: { capability: payload.repairCapability, title: task.title } }
        : {}),
    };
  }
  if (task.recurrenceRule) return { notice: "Recurring task completed and renewed." };
  return {
    notice: `${task.title} completed.`,
    ...(payload.undoCapability
      ? { undo: { capability: payload.undoCapability, title: task.title } }
      : {}),
  };
}
