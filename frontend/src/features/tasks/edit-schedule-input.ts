import type { UpdateTaskInput } from "@/graphql/graphql";
import type { ScheduleFields } from "./shift-schedule";

export function editScheduleInput(
  schedule: ScheduleFields,
  flexible: boolean,
): Pick<UpdateTaskInput, "planningWindow" | "startAt" | "endAt" | "dueDate" | "dueTime"> {
  const input = {
    startAt: localTime(schedule.start, "00:00"),
    endAt: localTime(schedule.end, "23:59"),
    dueDate: schedule.due?.slice(0, 10) || null,
    dueTime: schedule.due?.slice(11) || null,
  };
  if (flexible && schedule.start && schedule.end?.length === 10) {
    return {
      ...input,
      planningWindow: {
        startsOn: schedule.start.slice(0, 10),
        startsAtTime: schedule.start.slice(11) || null,
        endsOn: schedule.end,
      },
    };
  }
  return input;
}

function localTime(value: string | undefined, defaultClock: string) {
  if (!value) return null;
  return value.length === 10 ? `${value}T${defaultClock}` : value;
}
