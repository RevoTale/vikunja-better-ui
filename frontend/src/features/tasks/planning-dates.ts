import type { TaskKind } from "@/graphql/graphql";
import { currentDateInTimeZone, isValidLocalDate } from "./local-date-time";
import { formatLocalInstant } from "./shift-schedule";

export type PlanningPeriod = { from: string; through: string };
export type PlanningPreset = "today" | "week" | "month" | "year";
export type PlanningTask = {
  kind: TaskKind;
  endAt: string | null;
  dueAt: string | null;
  timezone: string;
};

export function planningPreset(
  preset: PlanningPreset,
  today: string,
  weekStart: number,
): PlanningPeriod {
  const date = new Date(`${today}T12:00:00Z`);
  if (preset === "today") return { from: today, through: today };
  if (preset === "year")
    return { from: `${today.slice(0, 4)}-01-01`, through: `${today.slice(0, 4)}-12-31` };
  if (preset === "week") {
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() - weekStart + 7) % 7));
    const from = date.toISOString().slice(0, 10);
    date.setUTCDate(date.getUTCDate() + 6);
    return { from, through: date.toISOString().slice(0, 10) };
  }
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return { from: `${today.slice(0, 7)}-01`, through: date.toISOString().slice(0, 10) };
}

export function planningWindowError(from: string, through: string, deadline = ""): string | null {
  if (!from && !through) return null;
  if (!isValidLocalDate(from) || !isValidLocalDate(through)) return "Choose both planning dates.";
  if (through < from) return "Planned finish must be on or after the start.";
  return planningDeadlineError(through, deadline);
}

export function planningDeadlineError(finish: string, deadline: string) {
  return deadline && finish > deadline ? "Planned finish cannot be after the deadline day." : null;
}

export function localTaskDate(instant: string | null, timezone: string): string | null {
  return instant ? (currentDateInTimeZone(timezone, new Date(instant)) ?? null) : null;
}

export function taskFinishDate(
  task: PlanningTask,
  period?: PlanningPeriod,
  today?: string,
): string | null {
  return localTaskDate(taskFinishInstant(task, period, today), task.timezone);
}

export function taskFinishInstant(
  task: PlanningTask,
  period?: PlanningPeriod,
  today?: string,
): string | null {
  const backlog = period && today && period.from <= today && today <= period.through;
  const finishes = [task.kind === "ONE_TIME" ? task.endAt : null, task.dueAt];
  const eligible = finishes.filter((instant): instant is string => {
    if (!instant) return false;
    if (!period) return true;
    const date = localTaskDate(instant, task.timezone);
    return date !== null && date <= period.through && (Boolean(backlog) || date >= period.from);
  });
  return eligible.sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null;
}

export function planningDateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function planningRangeLabel(from: string, through: string): string {
  if (!from && !through) return "No planning window";
  return `${from ? planningDateLabel(from) : "No start"} – ${through ? planningDateLabel(through) : "No finish"}`;
}

export function isWholePlanningDay(instant: string, timezone: string): boolean {
  return (
    formatLocalInstant(Date.parse(instant), timezone).endsWith("T23:59") &&
    new Date(instant).getUTCSeconds() === 59
  );
}

export function isWholePlanningWindow(task: {
  startAt: string | null;
  endAt: string | null;
  timezone: string;
}): boolean {
  return Boolean(
    task.startAt &&
      task.endAt &&
      formatLocalInstant(Date.parse(task.startAt), task.timezone).endsWith("T00:00") &&
      new Date(task.startAt).getUTCSeconds() === 0 &&
      isWholePlanningDay(task.endAt, task.timezone),
  );
}
