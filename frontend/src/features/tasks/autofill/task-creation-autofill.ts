import type { TaskPriority } from "@/graphql/graphql";
import type { CreationBaseType } from "../task-form-validation";
import { isTaskPriority } from "../task-priority";

export type TaskCreationVariant = "task" | "job";
export type TaskCreationScope = `${CreationBaseType}:${TaskCreationVariant}`;

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

export type TaskCreationAutofillField = keyof TaskCreationValues;
export type ChangeTaskCreationAutofillField = <Field extends TaskCreationAutofillField>(
  field: Field,
  value: TaskCreationValues[Field],
) => void;
export type RememberedTaskCreationValues = Partial<Omit<TaskCreationValues, "job">>;
type RememberedTaskCreationField = keyof RememberedTaskCreationValues;

export type TaskCreationAutofillMemory = {
  variant?: TaskCreationVariant;
  records: Partial<Record<TaskCreationScope, RememberedTaskCreationValues>>;
};

export type TaskCreationAutofillState = {
  values: TaskCreationValues;
  autofilled: ReadonlySet<TaskCreationAutofillField>;
  dirty: ReadonlySet<TaskCreationAutofillField>;
};

export type TaskCreationAutofillContext = {
  baseType: CreationBaseType;
  defaultDate: string;
  defaultProjectId: string;
  defaultJobStart: { date: string; time: string };
  accessibleProjectIds: readonly string[];
  explicitDate?: string;
  explicitProjectId?: string;
  explicitJob?: boolean;
};

const sharedFields = ["title", "projectId", "priority"] as const;
const taskScheduleFields = {
  "one-time": ["dueDate", "dueTime"],
  recurring: ["firstDueDate", "dueTime"],
} as const;
const jobScheduleFields = [
  "startDate",
  "startTime",
  "durationMinutes",
  "completionWindowMinutes",
] as const;

export function createInitialAutofillState(
  context: TaskCreationAutofillContext & { memory?: TaskCreationAutofillMemory },
): TaskCreationAutofillState {
  const memory = context.memory ?? { records: {} };
  const job = context.explicitJob ?? memory.variant === "job";
  const variant: TaskCreationVariant = job ? "job" : "task";
  const scope: TaskCreationScope = `${context.baseType}:${variant}`;
  const values = defaultValues(context, job);
  const autofilled = new Set<TaskCreationAutofillField>();
  const explicitProjectId = accessibleProject(context.explicitProjectId, context);
  const remembered = memory.records[scope];

  if (remembered) applyRemembered(values, autofilled, remembered, context, variant);

  if (context.explicitDate) {
    const dateField = job
      ? "startDate"
      : context.baseType === "recurring"
        ? "firstDueDate"
        : "dueDate";
    values[dateField] = context.explicitDate;
    autofilled.delete(dateField);
  }
  if (explicitProjectId) {
    values.projectId = explicitProjectId;
    autofilled.delete("projectId");
  }
  if (context.explicitJob === undefined && memory.variant === "job") {
    autofilled.add("job");
  }

  return { values, autofilled, dirty: new Set() };
}

export function changeAutofillField<Field extends TaskCreationAutofillField>(
  state: TaskCreationAutofillState,
  field: Field,
  value: TaskCreationValues[Field],
): TaskCreationAutofillState {
  const dirty = new Set(state.dirty).add(field);
  const autofilled = new Set(state.autofilled);
  autofilled.delete(field);
  return {
    values: { ...state.values, [field]: value },
    autofilled,
    dirty,
  };
}

export function switchAutofillVariant(
  state: TaskCreationAutofillState,
  job: boolean,
  context: TaskCreationAutofillContext,
  memory: TaskCreationAutofillMemory,
): TaskCreationAutofillState {
  const next = createInitialAutofillState({ ...context, explicitJob: job, memory });
  const dirty = new Set(state.dirty).add("job");
  const values = { ...next.values };
  const autofilled = new Set(next.autofilled);

  for (const field of dirty) {
    if (field !== "job") copyValue(values, state.values, field);
    autofilled.delete(field);
  }

  values.job = job;
  return { values, autofilled, dirty };
}

function copyValue<Field extends TaskCreationAutofillField>(
  target: TaskCreationValues,
  source: TaskCreationValues,
  field: Field,
): void {
  target[field] = source[field];
}

function defaultValues(context: TaskCreationAutofillContext, job: boolean): TaskCreationValues {
  return {
    job,
    title: "",
    projectId: context.defaultProjectId,
    priority: "UNSET",
    dueDate: "",
    dueTime: "",
    firstDueDate: context.defaultDate,
    startDate: context.defaultJobStart.date,
    startTime: context.defaultJobStart.time,
    durationMinutes: "60",
    completionWindowMinutes: "60",
  };
}

function applyRemembered(
  values: TaskCreationValues,
  autofilled: Set<TaskCreationAutofillField>,
  remembered: RememberedTaskCreationValues,
  context: TaskCreationAutofillContext,
  variant: TaskCreationVariant,
): void {
  const fields: readonly RememberedTaskCreationField[] = [
    ...sharedFields,
    ...(variant === "job" ? jobScheduleFields : taskScheduleFields[context.baseType]),
  ];

  for (const field of fields) {
    const value = remembered[field];
    if (!rememberedValueIsUsable(field, value, context)) continue;
    assignRememberedValue(values, field, value);
    autofilled.add(field);
  }
}

function assignRememberedValue<Field extends RememberedTaskCreationField>(
  values: TaskCreationValues,
  field: Field,
  value: NonNullable<RememberedTaskCreationValues[Field]>,
): void {
  values[field] = value;
}

function rememberedValueIsUsable<Field extends RememberedTaskCreationField>(
  field: Field,
  value: RememberedTaskCreationValues[Field],
  context: TaskCreationAutofillContext,
): value is NonNullable<RememberedTaskCreationValues[Field]> {
  if (typeof value !== "string" || value === "") return false;
  if (field === "projectId") return context.accessibleProjectIds.includes(value);
  if (field === "priority") return isTaskPriority(value);
  return true;
}

function accessibleProject(
  projectId: string | undefined,
  context: TaskCreationAutofillContext,
): string | undefined {
  return projectId && context.accessibleProjectIds.includes(projectId) ? projectId : undefined;
}
