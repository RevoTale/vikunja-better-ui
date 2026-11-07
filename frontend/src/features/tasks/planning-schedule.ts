import { displayTime } from "@/lib/time-format";
import { currentDateInTimeZone } from "./local-date-time";
import {
  isWholePlanningDay,
  localTaskDate,
  type PlanningPeriod,
  planningRangeLabel,
  taskFinishInstant,
} from "./planning-dates";
import type { ScheduleTask, TaskSchedule } from "./task-schedule";

export type ScheduleContext = {
  period?: PlanningPeriod | undefined;
  active?: boolean | undefined;
  backlog?: boolean;
};

export function planningSchedule(
  task: ScheduleTask,
  now: Date,
  use12Hours: boolean,
  context: ScheduleContext,
): TaskSchedule | null {
  if (task.kind !== "ONE_TIME" || !task.endAt) return null;
  const deadline = task.dueAt ? new Date(task.dueAt) : null;
  // An expired deadline always keeps the existing hard-overdue treatment.
  if (deadline && !task.isDone && deadline < now) return null;
  const today =
    context.period && context.backlog ? currentDateInTimeZone(task.timezone, now) : undefined;
  if (!context.active && taskFinishInstant(task, context.period, today) !== task.endAt) return null;
  const end = new Date(task.endAt);
  const missed = !task.isDone && end < now;
  const dateOnly = isWholePlanningDay(task.endAt, task.timezone);
  return {
    date: scheduleDate(end, task.timezone),
    time: dateOnly ? null : displayTime(end, task.timezone, use12Hours),
    status: planningStatus(task.isDone, missed),
    urgency: missed ? "soon" : "muted",
    completeBy: planningDetails(task, use12Hours, Boolean(context.active)),
  };
}

function planningStatus(done: boolean, missed: boolean): TaskSchedule["status"] {
  if (done) return null;
  return missed ? "Missed plan" : "Planned finish";
}

function planningDetails(task: ScheduleTask, use12Hours: boolean, active: boolean): string | null {
  const details = [];
  if (active && task.startAt) {
    details.push(
      `Available ${planningRangeLabel(localTaskDate(task.startAt, task.timezone) ?? "", localTaskDate(task.endAt, task.timezone) ?? "")}`,
    );
  }
  if (task.dueAt) {
    const deadline = new Date(task.dueAt);
    details.push(
      `Deadline ${scheduleDate(deadline, task.timezone)}${task.hasDueTime ? `, ${displayTime(deadline, task.timezone, use12Hours)}` : ""}`,
    );
  }
  return details.join(" · ") || null;
}

function scheduleDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: timezone,
  }).format(date);
}
