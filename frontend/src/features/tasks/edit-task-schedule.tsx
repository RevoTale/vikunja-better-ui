import type { SetStateAction } from "react";
import { EditDateTimeField } from "./edit-date-time-field";
import { EditJobDuration } from "./edit-job-duration";
import { scheduleFieldLabels } from "./schedule-field-labels";
import { ScheduleShift } from "./schedule-shift";
import type { ScheduleFields } from "./shift-schedule";

export function EditTaskSchedule({
  schedule,
  setSchedule,
  timezone,
  today,
  job,
  flexible,
  invalidPlanning,
}: {
  schedule: ScheduleFields;
  setSchedule: (next: SetStateAction<ScheduleFields>) => void;
  timezone: string;
  today: string;
  job: boolean;
  flexible: boolean;
  invalidPlanning: string | null;
}) {
  return (
    <>
      <ScheduleShift fields={schedule} timezone={timezone} onChange={setSchedule} />
      {(["start", "end", "due"] as const).map((field) => (
        <EditDateTimeField
          key={field}
          name={field}
          label={scheduleFieldLabels(flexible)[field]}
          value={schedule[field] ?? ""}
          defaultDate={today}
          onChange={(value) => setSchedule((current) => ({ ...current, [field]: value }))}
        />
      ))}
      {flexible ? (
        <p className="text-sm text-muted-foreground">
          Deadline means finish by this time. Unfinished tasks become overdue after it; Available
          from only controls when work becomes available.
        </p>
      ) : null}
      {invalidPlanning ? (
        <p role="alert" className="text-sm text-destructive">
          {invalidPlanning}
        </p>
      ) : null}
      {job ? (
        <EditJobDuration
          key={`${schedule.start}:${schedule.end}:${schedule.due}`}
          fields={schedule}
          timezone={timezone}
          onChange={setSchedule}
        />
      ) : null}
    </>
  );
}
