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
  return taskKindLabels(task).join(" · ");
}

export function taskKindLabels(task: TaskKindSource): string[] {
  if (task.kind !== "INVALID") {
    return task.kind === "JOB" && task.recurrenceRule
      ? [labels.JOB, labels.RECURRING]
      : [labels[task.kind]];
  }

  const hasHistory = task.labels.some((label) => label.title === "vbu:recurrence-history");

  if (hasHistory && task.recurrenceRule) return ["Invalid: history snapshot still repeats"];
  if (hasHistory && !task.isDone) return ["Invalid: history snapshot is incomplete"];
  return ["Invalid task configuration"];
}
