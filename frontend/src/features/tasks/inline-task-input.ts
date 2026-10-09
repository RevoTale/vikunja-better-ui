import type { TaskDetailsQuery, UpdateTaskInput } from "@/graphql/graphql";
import { formatLocalInstant } from "./shift-schedule";
import { visibleTaskLabels } from "./visible-task-labels";

export type InlineTask = NonNullable<TaskDetailsQuery["task"]>;
export type InlineTaskInput = Omit<UpdateTaskInput, "csrfToken">;
export type InlineTaskField =
  | "title"
  | "description"
  | "priority"
  | "project"
  | "labels"
  | "type"
  | "due"
  | "start"
  | "end";

export function inlineTaskInput(task: InlineTask): InlineTaskInput {
  const local = (value: string | null) =>
    value ? formatLocalInstant(Date.parse(value), task.timezone) : null;
  const due = local(task.dueAt);
  return {
    taskId: task.id,
    expectedVersion: task.version,
    title: task.title,
    description: task.description,
    projectId: task.project.id,
    priority: task.priority,
    job: task.kind === "JOB",
    labelIds: visibleTaskLabels(task.labels).map((label) => label.id),
    startAt: local(task.startAt),
    endAt: local(task.endAt),
    dueDate: due?.slice(0, 10) ?? null,
    dueTime: task.hasDueTime ? (due?.slice(11) ?? null) : null,
    recurrence: task.recurrenceRule
      ? {
          interval: task.recurrenceRule.interval,
          unit: task.recurrenceRule.unit,
          mode: task.recurrenceRule.mode,
          keepDueTime: task.recurrenceRule.keepDueTime,
        }
      : null,
  };
}
