import { useQuery } from "@apollo/client/react";
import { AppSelect } from "@/components/app-select";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { ProjectsDocument } from "@/graphql/graphql";
import { RecurrenceFields } from "./create-type-fields";
import { EditDateTimeField } from "./edit-date-time-field";
import type { InlineTask, InlineTaskField } from "./inline-task-input";
import { currentDateInTimeZone } from "./local-date-time";
import { TaskLabelPicker } from "./task-label-picker";
import { taskPriorityOptions } from "./task-priority";
import type { InlineTaskEditing } from "./use-inline-task-editing";

export function InlinePropertyFields({
  field,
  task,
  editor,
  onLabelsPending,
}: {
  field: InlineTaskField;
  task: InlineTask;
  editor: InlineTaskEditing;
  onLabelsPending: (pending: boolean) => void;
}) {
  if (field === "priority")
    return (
      <Field>
        <FieldLabel htmlFor="inline-priority">Priority</FieldLabel>
        <AppSelect
          id="inline-priority"
          value={editor.input.priority}
          options={taskPriorityOptions}
          onValueChange={(priority) => editor.setInput((input) => ({ ...input, priority }))}
        />
      </Field>
    );
  if (field === "project") return <InlineProjectField task={task} editor={editor} />;
  if (field === "labels")
    return <TaskLabelPicker initialLabels={task.labels} onPendingChange={onLabelsPending} />;
  if (field === "type") return <InlineTypeFields task={task} editor={editor} />;
  if (field === "due" || field === "start" || field === "end")
    return <InlineDateField field={field} task={task} editor={editor} />;
  return null;
}

function InlineProjectField({ task, editor }: { task: InlineTask; editor: InlineTaskEditing }) {
  const { data, loading, error, refetch } = useQuery(ProjectsDocument, {
    fetchPolicy: "cache-and-network",
  });
  const projects = [
    ...new Map(
      [task.project, ...(data?.projects.items ?? [])].map((project) => [project.id, project]),
    ).values(),
  ];
  return (
    <Field>
      <FieldLabel htmlFor="inline-project">Project</FieldLabel>
      <AppSelect
        id="inline-project"
        value={String(editor.input.projectId)}
        options={projects.map((project) => ({ value: String(project.id), label: project.title }))}
        onValueChange={(projectId) => editor.setInput((input) => ({ ...input, projectId }))}
      />
      {loading ? (
        <span role="status" className="text-xs text-muted-foreground">
          Updating projects…
        </span>
      ) : null}
      {error ? (
        <div role="alert">
          Projects could not be loaded.{" "}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void refetch().catch(() => undefined)}
          >
            Retry projects
          </Button>
        </div>
      ) : null}
    </Field>
  );
}

function InlineTypeFields({ task, editor }: { task: InlineTask; editor: InlineTaskEditing }) {
  const { input, setInput } = editor;
  return (
    <>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={input.job}
            onChange={(event) => {
              const job = event.currentTarget.checked;
              setInput((current) => ({ ...current, job }));
            }}
          />{" "}
          Job
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(input.recurrence)}
            onChange={(event) => {
              const recurring = event.currentTarget.checked;
              setInput((current) => ({
                ...current,
                recurrence: recurring
                  ? { interval: 1, unit: "DAY", mode: "FROM_COMPLETION", keepDueTime: true }
                  : null,
              }));
            }}
          />{" "}
          Recurring
        </label>
      </div>
      {(["start", "end", "due"] as const).map((field) => (
        <InlineDateField key={field} field={field} task={task} editor={editor} />
      ))}
      {input.recurrence ? (
        <RecurrenceFields
          initial={{
            ...input.recurrence,
            mode: input.recurrence.mode ?? "FROM_COMPLETION",
            keepDueTime: input.recurrence.keepDueTime ?? false,
          }}
          errors={{}}
          timeOfDay={input.job ? (input.startAt?.slice(11) ?? "") : (input.dueTime ?? "")}
          isJob={input.job}
        />
      ) : null}
      <p className="text-xs text-muted-foreground">
        Job needs Start, End and Due. Recurrence changes apply to this task and its future schedule;
        completed history stays unchanged.
      </p>
    </>
  );
}

function InlineDateField({
  field,
  task,
  editor,
}: {
  field: "due" | "start" | "end";
  task: InlineTask;
  editor: InlineTaskEditing;
}) {
  const input = editor.input;
  const value =
    field === "due"
      ? `${input.dueDate ?? ""}${input.dueTime ? `T${input.dueTime}` : ""}`
      : (input[field === "start" ? "startAt" : "endAt"] ?? "");
  return (
    <>
      <EditDateTimeField
        name={`inline-${field}`}
        label={{ due: "Due", start: "Start", end: "End" }[field]}
        value={value}
        defaultDate={currentDateInTimeZone(task.timezone) ?? ""}
        onChange={(next) =>
          editor.setInput((current) =>
            field === "due"
              ? { ...current, dueDate: next.slice(0, 10) || null, dueTime: next.slice(11) || null }
              : { ...current, [field === "start" ? "startAt" : "endAt"]: next || null },
          )
        }
      />
      <p className="text-xs text-muted-foreground">Timezone {task.timezone}</p>
    </>
  );
}
