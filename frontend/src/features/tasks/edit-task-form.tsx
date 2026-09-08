import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  ProjectsQuery,
  RecurrenceMode,
  RecurrenceUnit,
  TaskDetailsQuery,
  UpdateTaskInput,
} from "@/graphql/graphql";
import { SharedFields } from "./create-shared-fields";
import { RecurrenceFields } from "./create-type-fields";
import { EditDateTimeField } from "./edit-date-time-field";
import { EditJobDuration } from "./edit-job-duration";
import { currentDateInTimeZone } from "./local-date-time";
import { ScheduleShift } from "./schedule-shift";
import { formatLocalInstant, type ScheduleFields } from "./shift-schedule";

type Task = NonNullable<TaskDetailsQuery["task"]>;

export function EditTaskForm({
  task,
  projects,
  pending,
  onSave,
}: {
  task: Task;
  projects: ProjectsQuery["projects"]["items"];
  pending: boolean;
  onSave: (input: Omit<UpdateTaskInput, "csrfToken">) => Promise<void>;
}) {
  const [expectedVersion] = useState(task.version);
  const today = currentDateInTimeZone(task.timezone) ?? "";
  const [recurring, setRecurring] = useState(Boolean(task.recurrenceRule));
  const [values, setValues] = useState(() => ({
    projectId: task.project.id,
    title: task.title,
    priority: task.priority,
    job: task.kind === "JOB",
  }));
  const [schedule, setSchedule] = useState<ScheduleFields>(() => ({
    start: local(task.startAt, task.timezone),
    end: local(task.endAt, task.timezone),
    due: task.hasDueTime
      ? local(task.dueAt, task.timezone)
      : local(task.dueAt, task.timezone).slice(0, 10),
  }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onSave({
      taskId: task.id,
      expectedVersion,
      title: values.title,
      description: String(form.get("description") ?? ""),
      projectId: values.projectId,
      priority: values.priority,
      job: values.job,
      dueDate: schedule.due?.slice(0, 10) || null,
      dueTime: schedule.due?.slice(11) || null,
      startAt: schedule.start || null,
      endAt: schedule.end || null,
      recurrence: recurring
        ? {
            interval: Number(form.get("interval")),
            unit: String(form.get("unit")) as RecurrenceUnit,
            mode: String(form.get("mode")) as RecurrenceMode,
            keepDueTime: form.get("keepDueTime") === "on",
          }
        : null,
    });
  }
  return (
    <form onSubmit={submit} className="mt-5">
      <fieldset disabled={pending} className="grid min-w-0 gap-5">
        <legend className="sr-only">Edit task fields</legend>
        <SharedFields
          projects={projects}
          errors={{}}
          type={recurring ? "recurring" : "one-time"}
          titlePlaceholder=""
          values={values}
          description={task.description}
          titleRequired
          autofilled={new Set()}
          onFieldChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
        />
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.job}
              onChange={(event) => setValues({ ...values, job: event.currentTarget.checked })}
            />{" "}
            Job
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(event) => setRecurring(event.currentTarget.checked)}
            />{" "}
            Recurring
          </label>
        </div>
        <ScheduleShift fields={schedule} timezone={task.timezone} onChange={setSchedule} />
        {(["start", "end", "due"] as const).map((field) => (
          <EditDateTimeField
            key={field}
            name={field}
            label={{ start: "Start", end: "End", due: "Due" }[field]}
            value={schedule[field] ?? ""}
            defaultDate={today}
            onChange={(value) => setSchedule((current) => ({ ...current, [field]: value }))}
          />
        ))}
        {values.job ? (
          <EditJobDuration
            key={`${schedule.start}:${schedule.end}:${schedule.due}`}
            fields={schedule}
            timezone={task.timezone}
            onChange={setSchedule}
          />
        ) : null}
        {recurring ? (
          <RecurrenceFields
            errors={{}}
            timeOfDay={(values.job ? schedule.start : schedule.due)?.slice(11) ?? ""}
            isJob={values.job}
            initial={task.recurrenceRule}
          />
        ) : null}
        {recurring ? (
          <p className="text-sm text-muted-foreground">
            Changes apply to this task and its future schedule. Completed history stays unchanged.
          </p>
        ) : null}
        <Button type="submit">{pending ? "Saving…" : "Save changes"}</Button>
      </fieldset>
    </form>
  );
}

function local(value: string | null, timezone: string): string {
  return value ? formatLocalInstant(Date.parse(value), timezone) : "";
}
