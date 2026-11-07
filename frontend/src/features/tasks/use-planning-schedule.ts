import { type SetStateAction, useState } from "react";
import type { PlanningWindowInput } from "@/graphql/graphql";
import type { InlineTask } from "./inline-task-input";
import { planningDeadlineError, planningWindowError } from "./planning-dates";
import { formatLocalInstant, type ScheduleFields } from "./shift-schedule";

export function usePlanningSchedule(task: InlineTask, flexible: boolean) {
  const [initial] = useState<ScheduleFields>(() => ({
    start: local(task.startAt, task.timezone),
    end: local(task.endAt, task.timezone),
    due: task.hasDueTime
      ? local(task.dueAt, task.timezone)
      : local(task.dueAt, task.timezone).slice(0, 10),
  }));
  const [state, setState] = useState(() => ({ schedule: initial, planningChanged: false }));
  const { schedule, planningChanged } = state;
  const planning = planningChanged ? planningInput(schedule) : undefined;
  const invalidPlanning = flexible ? editedPlanningError(schedule, initial, planningChanged) : null;
  const changeSchedule = (next: SetStateAction<ScheduleFields>) => {
    setState((current) => {
      const updated = typeof next === "function" ? next(current.schedule) : next;
      const sameWindow =
        updated.start === current.schedule.start && updated.end === current.schedule.end;
      return { schedule: updated, planningChanged: sameWindow && current.planningChanged };
    });
  };
  const changePlanning = (next: PlanningWindowInput | null) => {
    setState((current) => ({
      planningChanged: true,
      schedule: {
        ...current.schedule,
        start: next?.startsOn ? `${next.startsOn}T00:00` : "",
        end: next?.endsOn ? `${next.endsOn}T23:59` : "",
      },
    }));
  };
  return { planning, schedule, invalidPlanning, changeSchedule, changePlanning };
}

export function editedPlanningError(
  schedule: ScheduleFields,
  initial: ScheduleFields,
  planningChanged: boolean,
): string | null {
  const exactTimesChanged = schedule.start !== initial.start || schedule.end !== initial.end;
  if (!planningChanged && !exactTimesChanged && schedule.due === initial.due) return null;
  const from = schedule.start?.slice(0, 10) ?? "";
  const through = schedule.end?.slice(0, 10) ?? "";
  const deadline = schedule.due?.slice(0, 10) ?? "";
  if (planningChanged) return planningWindowError(from, through, deadline);
  // Exact schedules may have a single boundary.
  const start = schedule.start?.length === 10 ? `${schedule.start}T00:00` : schedule.start;
  const end = schedule.end?.length === 10 ? `${schedule.end}T23:59:59` : schedule.end;
  if (exactTimesChanged && start && end && end <= start) return "End must be after start.";
  return planningDeadlineError(through, deadline);
}

function local(value: string | null, timezone: string): string {
  return value ? formatLocalInstant(Date.parse(value), timezone) : "";
}

function planningInput(schedule: ScheduleFields): PlanningWindowInput | null {
  if (!schedule.start && !schedule.end) return null;
  return { startsOn: schedule.start?.slice(0, 10) ?? "", endsOn: schedule.end?.slice(0, 10) ?? "" };
}
