import type { CreationBaseType } from "../task-form-validation";
import { isTaskPriority } from "../task-priority";
import type {
  RememberedTaskCreationValues,
  TaskCreationAutofillMemory,
  TaskCreationScope,
  TaskCreationVariant,
} from "./task-creation-autofill";

const prefix = "vbu:task-create-autofill:v1";
const version = 1;

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type TaskCreationSnapshot = {
  baseType: CreationBaseType;
  variant: TaskCreationVariant;
  values: RememberedTaskCreationValues;
};

export type TaskCreationMemoryStore = {
  load(baseType: CreationBaseType): TaskCreationAutofillMemory;
  save(snapshot: TaskCreationSnapshot): void;
};

export function createTaskCreationMemoryStore(
  storage: StorageLike | undefined,
): TaskCreationMemoryStore {
  return {
    load(baseType) {
      if (!storage) return { records: {} };
      const records: TaskCreationAutofillMemory["records"] = {};
      for (const variant of ["task", "job"] as const) {
        const scope: TaskCreationScope = `${baseType}:${variant}`;
        const record = readRecord(storage, scope);
        if (record) records[scope] = record;
      }
      const variant = readVariant(storage, baseType);
      return variant ? { variant, records } : { records };
    },
    save(snapshot) {
      if (!storage) return;
      const scope: TaskCreationScope = `${snapshot.baseType}:${snapshot.variant}`;
      try {
        storage.setItem(recordKey(scope), JSON.stringify({ version, values: snapshot.values }));
        storage.setItem(variantKey(snapshot.baseType), snapshot.variant);
      } catch {
        // Autofill is optional and must never change a successful creation result.
      }
    },
  };
}

export function browserTaskCreationMemoryStore(): TaskCreationMemoryStore {
  try {
    return createTaskCreationMemoryStore(
      typeof window === "undefined" ? undefined : window.localStorage,
    );
  } catch {
    return createTaskCreationMemoryStore(undefined);
  }
}

export function taskCreationSnapshot(
  baseType: CreationBaseType,
  form: FormData,
): TaskCreationSnapshot {
  const variant: TaskCreationVariant = text(form, "job") === "on" ? "job" : "task";
  const values: RememberedTaskCreationValues = {};

  add(values, "title", text(form, "title").trim());
  add(values, "projectId", text(form, "projectId"));
  const priority = text(form, "priority");
  if (isTaskPriority(priority)) values.priority = priority;

  if (variant === "job") {
    add(values, "startDate", text(form, "startDate"));
    add(values, "startTime", text(form, "startTime"));
    add(values, "durationMinutes", text(form, "durationMinutes"));
    add(values, "completionWindowMinutes", text(form, "completionWindowMinutes"));
  } else if (baseType === "recurring") {
    add(values, "firstDueDate", text(form, "firstDueDate"));
    add(values, "dueTime", text(form, "dueTime"));
  } else {
    add(values, "dueDate", text(form, "dueDate"));
    add(values, "dueTime", text(form, "dueTime"));
  }

  return { baseType, variant, values };
}

export function rememberSuccessfulTaskCreation(snapshot: TaskCreationSnapshot): void {
  browserTaskCreationMemoryStore().save(snapshot);
}

function readRecord(
  storage: StorageLike,
  scope: TaskCreationScope,
): RememberedTaskCreationValues | undefined {
  try {
    const raw = storage.getItem(recordKey(scope));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed["version"] !== version || !isRecord(parsed["values"])) {
      return undefined;
    }
    return decodeValues(parsed["values"]);
  } catch {
    return undefined;
  }
}

function readVariant(
  storage: StorageLike,
  baseType: CreationBaseType,
): TaskCreationVariant | undefined {
  try {
    const value = storage.getItem(variantKey(baseType));
    return value === "task" || value === "job" ? value : undefined;
  } catch {
    return undefined;
  }
}

function decodeValues(value: Record<string, unknown>): RememberedTaskCreationValues {
  const decoded: RememberedTaskCreationValues = {};
  for (const field of [
    "title",
    "projectId",
    "dueDate",
    "dueTime",
    "firstDueDate",
    "startDate",
    "startTime",
    "durationMinutes",
    "completionWindowMinutes",
  ] as const) {
    const fieldValue = value[field];
    if (typeof fieldValue === "string" && fieldValue !== "") decoded[field] = fieldValue;
  }
  const priority = value["priority"];
  if (typeof priority === "string" && isTaskPriority(priority)) decoded.priority = priority;
  return decoded;
}

function add(
  values: RememberedTaskCreationValues,
  field: Exclude<keyof RememberedTaskCreationValues, "priority">,
  value: string,
): void {
  if (value !== "") values[field] = value;
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "");
}

function recordKey(scope: TaskCreationScope): string {
  return `${prefix}:${scope}`;
}

function variantKey(baseType: CreationBaseType): string {
  return `${prefix}:${baseType}:last-variant`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
