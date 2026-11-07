import type { ScheduleFields } from "./shift-schedule";
import type { TaskCreationValues } from "./task-creation-values";

export type ReminderAnchor = { value: string; label: string; available: boolean };

export function editReminderAnchors(schedule: ScheduleFields, job: boolean) {
  return reminderAnchors(
    Boolean(schedule.start),
    Boolean(schedule.end),
    Boolean(schedule.due),
    job,
  );
}

export function reminderAnchors(
  start: boolean,
  end: boolean,
  due: boolean,
  job: boolean,
): ReminderAnchor[] {
  const deadline = { value: "due_date", label: "Deadline", available: due };
  const finish = {
    value: "end_date",
    label: job ? "Session end" : "Planned finish",
    available: end,
  };
  const startAnchor = {
    value: "start_date",
    label: job ? "Session start" : "Available from",
    available: start,
  };
  return job ? [startAnchor, finish, deadline] : [deadline, finish, startAnchor];
}

export function creationReminderAnchors(values: TaskCreationValues, recurring: boolean) {
  if (values.job) return reminderAnchors(Boolean(values.startDate), true, true, true);
  return reminderAnchors(
    recurring ? Boolean(values.firstDueDate) : Boolean(values.planningEndsOn),
    !recurring && Boolean(values.planningEndsOn),
    Boolean(recurring ? values.firstDueDate : values.dueDate),
    false,
  );
}
