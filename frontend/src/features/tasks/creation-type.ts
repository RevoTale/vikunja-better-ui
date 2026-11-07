import type { CreationType } from "./task-form-validation";

const taskTypeLabels: Record<CreationType, string> = {
  "one-time": "one-time task",
  recurring: "recurring task",
  job: "timed session",
};

export function taskTypeLabel(type: CreationType): string {
  return taskTypeLabels[type];
}
