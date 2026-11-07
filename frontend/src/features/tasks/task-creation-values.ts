import type { TaskPriority } from "@/graphql/graphql";

export type TaskCreationValues = {
  job: boolean;
  title: string;
  projectId: string;
  priority: TaskPriority;
  dueDate: string;
  dueTime: string;
  planningStartsOn: string;
  planningEndsOn: string;
  planningFinishTime: string;
  planningStartTime: string;
  availableFromTime: string;
  planningSpecific: boolean;
  firstDueDate: string;
  availableFrom: string;
  availabilitySpecific: boolean;
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
  priority?: TaskPriority;
  today: string;
  date: string | undefined;
  jobStart: { date: string; time: string };
}): TaskCreationValues {
  return {
    job: context.job,
    title: "",
    projectId: context.projectId,
    priority: context.priority ?? "UNSET",
    dueDate: "",
    dueTime: "",
    planningStartsOn: context.date ?? "",
    planningEndsOn: context.date ?? "",
    planningFinishTime: "",
    planningStartTime: "",
    availableFromTime: "",
    planningSpecific: Boolean(context.date),
    firstDueDate: context.date ?? context.today,
    availableFrom: context.date ?? "",
    availabilitySpecific: Boolean(context.date),
    startDate: context.date ?? context.jobStart.date,
    startTime: context.jobStart.time,
    durationMinutes: "60",
    completionWindowMinutes: "60",
  };
}
