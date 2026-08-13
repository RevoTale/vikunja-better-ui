import type { TaskKind } from "@/graphql/graphql";

type TaskKindSource = {
  kind: TaskKind;
  isDone: boolean;
  recurrenceRule: unknown | null;
  labels: ReadonlyArray<{ title: string }>;
};

const labels: Record<Exclude<TaskKind, "INVALID">, string> = {
  ONE_TIME: "One-time",
  RECURRING: "Recurring",
  JOB: "Job",
};

export function taskKindLabel(task: TaskKindSource): string {
  if (task.kind !== "INVALID") return labels[task.kind];

  const hasJob = task.labels.some((label) => label.title === "job");
  const hasHistory = task.labels.some((label) => label.title === "vbu:recurrence-history");

  if (task.recurrenceRule && hasJob) return "Invalid: both recurring and job";
  if (hasHistory && task.recurrenceRule) return "Invalid: history snapshot still repeats";
  if (hasHistory && hasJob) return "Invalid: history snapshot marked as job";
  if (hasHistory && !task.isDone) return "Invalid: history snapshot is incomplete";
  return "Invalid task configuration";
}
