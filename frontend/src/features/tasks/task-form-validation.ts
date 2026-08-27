import { composeLocalDateTime, isValidLocalDate, isValidLocalTime } from "./local-date-time";
import { isTaskPriority } from "./task-priority";

export type CreationType = "one-time" | "recurring" | "job";
export type CreationBaseType = Exclude<CreationType, "job">;

export type TaskFormField =
  | "title"
  | "projectId"
  | "priority"
  | "dueDate"
  | "dueTime"
  | "firstDueDate"
  | "interval"
  | "unit"
  | "mode"
  | "keepDueTime"
  | "job"
  | "startDate"
  | "startTime"
  | "durationMinutes"
  | "completionWindowMinutes";

export type TaskFormErrors = Partial<Record<TaskFormField, string>>;

const maxInterval = { DAY: 106_751, WEEK: 15_250 } as const;
const maxDurationMinutes = 153_722_867;

export function validateTaskForm(type: CreationType, form: FormData): TaskFormErrors {
  const isJob = type === "job" || value(form, "job") === "on";
  const isRecurring = type === "recurring";
  const errors = validateSharedFields(isJob, isRecurring, form);

  if (isJob) validateJobFields(form, errors);
  else if (isRecurring) validateRecurringDateFields(form, errors);
  else validateOneTimeFields(form, errors);

  if (isRecurring) validateRecurrenceFields(form, errors, isJob);

  return errors;
}

export function hasTaskFormErrors(errors: TaskFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function serverTaskFormErrors(
  type: CreationType,
  form: FormData,
  message: string,
): TaskFormErrors {
  const normalized = message.toLowerCase();
  if (normalized.includes("project id") || normalized.includes("selected project")) {
    return { projectId: "Choose an accessible project." };
  }
  if (normalized.includes("title is required")) return { title: "Enter a title." };
  if (normalized.includes("first due date")) {
    return { firstDueDate: "Choose the first due date." };
  }
  if (normalized.includes("due time requires")) {
    return { dueTime: "Choose a due date before setting a time." };
  }
  if (normalized.includes("recurrence interval")) {
    return { interval: "Choose a valid, smaller interval." };
  }
  if (normalized.includes("recurrence unit")) {
    return { unit: "Choose days, weeks, or months." };
  }
  if (normalized.includes("recurrence mode") || normalized.includes("month interval")) {
    return { mode: "Choose a recurrence mode Vikunja supports." };
  }
  if (normalized.includes("duration is too large")) {
    return { durationMinutes: "Choose a shorter duration." };
  }
  if (normalized.includes("completion window is too large")) {
    return { completionWindowMinutes: "Choose a shorter completion window." };
  }
  if (normalized.includes("timezone transition")) {
    const detail = normalized.includes("ambiguous")
      ? "This time is ambiguous in your Vikunja timezone. Choose another time."
      : "This time does not exist in your Vikunja timezone. Choose another time.";
    return { [timezoneField(type, form)]: detail };
  }
  return {};
}

function validateSharedFields(
  isJob: boolean,
  isRecurring: boolean,
  form: FormData,
): TaskFormErrors {
  const errors: TaskFormErrors = {};
  const title = value(form, "title").trim();
  if (!title && (!isJob || isRecurring)) errors.title = "Enter a title.";
  else if (title.length > 250) errors.title = "Use 250 characters or fewer.";

  if (!/^[1-9]\d*$/.test(value(form, "projectId"))) {
    errors.projectId = "Choose a project.";
  }
  if (!isTaskPriority(value(form, "priority"))) {
    errors.priority = "Choose a priority.";
  }
  return errors;
}

function validateOneTimeFields(form: FormData, errors: TaskFormErrors): void {
  const dueDate = value(form, "dueDate");
  const dueTime = value(form, "dueTime");
  if (dueDate && !isValidLocalDate(dueDate)) errors.dueDate = "Enter a valid date.";
  if (dueTime && !dueDate) errors.dueTime = "Choose a due date before setting a time.";
  else if (dueTime && !isValidLocalTime(dueTime)) errors.dueTime = "Enter a valid time.";
}

function validateRecurrenceFields(form: FormData, errors: TaskFormErrors, isJob: boolean): void {
  const dueTime = value(form, "dueTime");
  const startTime = value(form, "startTime");
  const unit = value(form, "unit");
  const mode = value(form, "mode");
  const keepDueTime = value(form, "keepDueTime") === "on";
  const interval = wholeNumber(value(form, "interval"), 1);

  validateRecurrenceRule(interval, unit, mode, errors);
  validateFixedDueTime(keepDueTime, isJob ? startTime : dueTime, unit, mode, errors, isJob);
}

function validateRecurringDateFields(form: FormData, errors: TaskFormErrors): void {
  const firstDueDate = value(form, "firstDueDate");
  const dueTime = value(form, "dueTime");
  if (!firstDueDate) errors.firstDueDate = "Choose the first due date.";
  else if (!isValidLocalDate(firstDueDate)) errors.firstDueDate = "Enter a valid date.";
  if (dueTime && !isValidLocalTime(dueTime)) errors.dueTime = "Enter a valid time.";
}

function validateRecurrenceRule(
  interval: number | undefined,
  unit: string,
  mode: string,
  errors: TaskFormErrors,
): void {
  if (interval === undefined) errors.interval = "Enter a whole number of 1 or more.";
  if (unit !== "DAY" && unit !== "WEEK" && unit !== "MONTH") {
    errors.unit = "Choose days, weeks, or months.";
  }
  if (mode !== "FROM_COMPLETION" && mode !== "SCHEDULED_CYCLE") {
    errors.mode = "Choose how the recurrence renews.";
  }

  if (interval !== undefined && unit === "DAY" && interval > maxInterval.DAY) {
    errors.interval = "Choose a smaller interval.";
  }
  if (interval !== undefined && unit === "WEEK" && interval > maxInterval.WEEK) {
    errors.interval = "Choose a smaller interval.";
  }
  if (unit === "MONTH" && interval !== undefined && interval !== 1) {
    errors.interval = "Monthly recurrence supports every 1 month.";
  }
  if (unit === "MONTH" && mode === "FROM_COMPLETION") {
    errors.mode = "Monthly recurrence must use Scheduled cycle.";
  }
}

function validateFixedDueTime(
  keepDueTime: boolean,
  time: string,
  unit: string,
  mode: string,
  errors: TaskFormErrors,
  isJob: boolean,
): void {
  if (keepDueTime && !time) {
    if (isJob) errors.startTime = "Choose a start time to keep.";
    else errors.dueTime = "Choose a due time to keep.";
  }
  if (keepDueTime && mode !== "FROM_COMPLETION") {
    errors.mode = "Keep due time requires From completion.";
  }
  if (keepDueTime && unit !== "DAY" && unit !== "WEEK") {
    errors.unit = "Keep due time supports days or weeks.";
  }
}

function validateJobFields(form: FormData, errors: TaskFormErrors): void {
  const startDate = value(form, "startDate");
  const startTime = value(form, "startTime");
  const startAt = composeLocalDateTime({ date: startDate, time: startTime });
  const duration = wholeNumber(value(form, "durationMinutes"), 1, maxDurationMinutes);
  const completionWindow = wholeNumber(
    value(form, "completionWindowMinutes"),
    1,
    maxDurationMinutes,
  );

  if (!startDate) errors.startDate = "Choose a start date.";
  else if (!isValidLocalDate(startDate)) errors.startDate = "Enter a valid date.";
  if (!startTime) errors.startTime = "Choose a start time.";
  else if (!isValidLocalTime(startTime)) errors.startTime = "Enter a valid time.";
  if (duration === undefined) {
    errors.durationMinutes = "Enter a whole number of 1 or more.";
  }
  if (completionWindow === undefined) {
    errors.completionWindowMinutes = "Enter a whole number of 1 or more.";
  }
  if (!startAt || duration === undefined) return;

  const end = localMinute(startAt) + duration * 60_000;
  if (end > lastSupportedMinute()) {
    errors.durationMinutes = "The job end must be before year 10000.";
    return;
  }
  if (completionWindow !== undefined && end + completionWindow * 60_000 > lastSupportedMinute()) {
    errors.completionWindowMinutes = "The completion deadline must be before year 10000.";
  }
}

function value(form: FormData, name: TaskFormField): string {
  return String(form.get(name) ?? "");
}

function timezoneField(type: CreationType, form: FormData): TaskFormField {
  if (type === "job" || value(form, "job") === "on") return "startTime";
  if (value(form, "dueTime")) return "dueTime";
  return type === "recurring" ? "firstDueDate" : "dueDate";
}

function wholeNumber(text: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER) {
  if (!/^-?\d+$/.test(text)) return undefined;
  const number = Number(text);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum
    ? number
    : undefined;
}

function localMinute(value: string): number {
  const date = new Date(0);
  date.setUTCFullYear(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
  date.setUTCHours(Number(value.slice(11, 13)), Number(value.slice(14, 16)), 0, 0);
  return date.getTime();
}

function lastSupportedMinute(): number {
  return Date.UTC(9999, 11, 31, 23, 59);
}
