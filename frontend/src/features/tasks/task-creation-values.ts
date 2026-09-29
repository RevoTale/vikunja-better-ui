import type { TaskPriority } from "@/graphql/graphql";

export type TaskCreationValues = {
  job: boolean;
  title: string;
  projectId: string;
  priority: TaskPriority;
  dueDate: string;
  dueTime: string;
  firstDueDate: string;
  startDate: string;
  startTime: string;
  durationMinutes: string;
  completionWindowMinutes: string;
};

export type ChangeTaskCreationField = <Field extends keyof TaskCreationValues>(
  field: Field,
  value: TaskCreationValues[Field],
) => void;

export function defaultTaskCreationValues(context: {
  job: boolean;
  projectId: string;
  today: string;
  date: string | undefined;
  jobStart: { date: string; time: string };
}): TaskCreationValues {
  return {
    job: context.job,
    title: "",
    projectId: context.projectId,
    priority: "UNSET",
    dueDate: context.date ?? "",
    dueTime: "",
    firstDueDate: context.date ?? context.today,
    startDate: context.date ?? context.jobStart.date,
    startTime: context.jobStart.time,
    durationMinutes: "60",
    completionWindowMinutes: "60",
  };
}
