import type { TaskKind } from "@/graphql/graphql";

const soonThresholdMilliseconds = 2 * 60 * 60 * 1_000;

type ScheduleTask = {
  kind: TaskKind;
  dueAt: string | null;
  hasDueTime: boolean;
  startAt: string | null;
  endAt: string | null;
  timezone: string;
  isDone: boolean;
};

export type TaskUrgency = "muted" | "normal" | "soon" | "overdue";

export type TaskSchedule = {
  date: string;
  time: string | null;
  status: "Overdue" | null;
  urgency: TaskUrgency;
  completeBy: string | null;
};

export function taskSchedule(task: ScheduleTask, now = new Date()): TaskSchedule {
  const interval = jobInterval(task);
  if (!task.dueAt) {
    return interval && task.startAt
      ? jobWithoutDeadline(task.startAt, task.timezone, interval)
      : emptySchedule();
  }

  const due = new Date(task.dueAt);
  const urgency = task.isDone ? "muted" : urgencyFor(due, task.hasDueTime, now);
  const dateSource = interval && task.startAt ? new Date(task.startAt) : due;

  return {
    date: formatDate(dateSource, task.timezone),
    time: interval ?? (task.hasDueTime ? formatTime(due, task.timezone) : null),
    status: urgency === "overdue" ? "Overdue" : null,
    urgency,
    completeBy: interval ? `Complete by ${formatTime(due, task.timezone)}` : null,
  };
}

function jobWithoutDeadline(startAt: string, timezone: string, interval: string): TaskSchedule {
  return {
    date: formatDate(new Date(startAt), timezone),
    time: interval,
    status: null,
    urgency: "muted",
    completeBy: null,
  };
}

function emptySchedule(): TaskSchedule {
  return {
    date: "No deadline",
    time: null,
    status: null,
    urgency: "muted",
    completeBy: null,
  };
}

function urgencyFor(due: Date, hasDueTime: boolean, now: Date): TaskUrgency {
  if (!hasDueTime) return "muted";
  const remaining = due.getTime() - now.getTime();
  if (remaining < 0) return "overdue";
  return remaining <= soonThresholdMilliseconds ? "soon" : "normal";
}

function jobInterval(task: ScheduleTask): string | null {
  if (task.kind !== "JOB" || !task.startAt || !task.endAt) return null;
  return `${formatTime(new Date(task.startAt), task.timezone)}–${formatTime(
    new Date(task.endAt),
    task.timezone,
  )}`;
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
  }).format(value);
}

function formatTime(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}
