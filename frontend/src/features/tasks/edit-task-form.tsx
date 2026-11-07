import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  ProjectsQuery,
  RecurrenceMode,
  RecurrenceUnit,
  TaskDetailsQuery,
  UpdateTaskInput,
} from "@/graphql/graphql";
import { editScheduleInput } from "./edit-schedule-input";
import { StoragePreview } from "./edit-storage-preview";
import { editStorageRows } from "./edit-storage-rows";
import { EditTaskSchedule } from "./edit-task-schedule";
import { currentDateInTimeZone } from "./local-date-time";
import { RecurrenceFields } from "./recurrence-fields";
import { editReminderAnchors } from "./reminder-anchors";
import { formReminders, ReminderFields } from "./reminder-fields";
import { reminderPreviewRows } from "./reminder-preview";
import { TaskFormSections } from "./task-form-sections";
import { TaskFrequencyChoice } from "./task-plan-choice";
import { usePlanningSchedule } from "./use-planning-schedule";

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
  const [labelsPending, setLabelsPending] = useState(false);
  const today = currentDateInTimeZone(task.timezone) ?? "";
  const [recurring, setRecurring] = useState(Boolean(task.recurrenceRule));
  const [values, setValues] = useState(() => ({
    projectId: task.project.id,
    title: task.title,
    priority: task.priority,
    job: task.kind === "JOB",
  }));
  const { schedule, invalidPlanning, changeSchedule } = usePlanningSchedule(
    task,
    !values.job && !recurring,
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (labelsPending || invalidPlanning) return;
    await onSave(readDraft(event.currentTarget));
  }
  function readDraft(element: HTMLFormElement): Omit<UpdateTaskInput, "csrfToken"> {
    const form = new FormData(element);
    return {
      reminders: formReminders(form),
      taskId: task.id,
      expectedVersion,
      ...editScheduleInput(schedule, !values.job && !recurring),
      labelIds: form.getAll("labelIds").map(String),
      title: values.title,
      description: String(form.get("description") ?? ""),
      projectId: values.projectId,
      priority: values.priority,
      job: values.job,
      recurrence: recurring
        ? {
            interval: Number(form.get("interval")),
            unit: String(form.get("unit")) as RecurrenceUnit,
            mode: String(form.get("mode")) as RecurrenceMode,
            keepDueTime: form.get("keepDueTime") === "on",
          }
        : null,
    };
  }
  return (
    <form onSubmit={submit} className="mt-5">
      <fieldset disabled={pending} className="grid min-w-0 grid-cols-1 gap-5">
        <legend className="sr-only">Edit task fields</legend>
        <TaskFrequencyChoice recurring={recurring} onChange={setRecurring} />
        <TaskFormSections
          initialLabels={task.labels}
          onLabelsPending={setLabelsPending}
          disabled={pending}
          projects={projects}
          errors={{}}
          type={recurring ? "recurring" : "one-time"}
          titlePlaceholder=""
          values={values}
          description={task.description}
          titleRequired
          onFieldChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
        >
          <EditTaskSchedule
            schedule={schedule}
            setSchedule={changeSchedule}
            flexible={!values.job && !recurring}
            invalidPlanning={invalidPlanning}
            timezone={task.timezone}
            today={today}
            job={values.job}
          />
          <RecurrenceFields
            enabled={recurring}
            errors={{}}
            timeOfDay={(values.job ? schedule.start : schedule.due)?.slice(11) ?? ""}
            isJob={values.job}
            initial={task.recurrenceRule}
          />
          {recurring ? (
            <p className="text-sm text-muted-foreground">
              Changes apply to this task and its future schedule. Completed history stays unchanged.
            </p>
          ) : null}
          <ReminderFields
            initial={task.reminders}
            timezone={task.timezone}
            anchors={editReminderAnchors(schedule, values.job)}
          />
        </TaskFormSections>
        <Button type="submit" disabled={labelsPending || Boolean(invalidPlanning)}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <StoragePreview
          readRows={(form) => [
            ...editStorageRows(readDraft(form), task),
            ...reminderPreviewRows(new FormData(form)),
          ]}
          timezone={task.timezone}
          disabled={labelsPending || Boolean(invalidPlanning)}
        />
      </fieldset>
    </form>
  );
}
