import type { CreationType } from "./task-form-validation";

const taskTypeLabels: Record<CreationType, string> = {
  "one-time": "one-time task",
  recurring: "recurring task",
  job: "job",
};

const shortTaskTypeLabels: Record<CreationType, string> = {
  "one-time": "One-time",
  recurring: "Recurring",
  job: "Job",
};

export function taskTypeLabel(type: CreationType): string {
  return taskTypeLabels[type];
}

export function shortTaskTypeLabel(type: CreationType): string {
  return shortTaskTypeLabels[type];
}
