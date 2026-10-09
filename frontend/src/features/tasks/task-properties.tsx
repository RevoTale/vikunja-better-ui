import { CalendarDays, Circle, Clock3, Folder, ListFilter, Repeat2, Tags } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { TaskDetailsQuery } from "@/graphql/graphql";
import { useTwelveHourTime } from "@/lib/time-format-context";
import { formatDateTime } from "./format-date-time";
import { InlineProperty } from "./inline-property";
import type { InlineTaskField } from "./inline-task-input";
import { InlineTaskStatus } from "./inline-task-status";
import { PriorityBadge } from "./priority-badge";
import { taskKindLabels } from "./task-kind-label";
import { TaskRecurrenceSetting } from "./task-recurrence-setting";
import type { InlineTaskEditing } from "./use-inline-task-editing";
import { visibleTaskLabels } from "./visible-task-labels";

type TaskDetail = NonNullable<TaskDetailsQuery["task"]>;

export function TaskProperties({
  task,
  onChanged,
  editor,
}: {
  task: TaskDetail;
  onChanged: () => Promise<unknown>;
  editor: InlineTaskEditing;
}) {
  const labels = visibleTaskLabels(task.labels);
  const use12Hours = useTwelveHourTime();
  const emptyLabelsText = task.isDone ? "—" : "Add labels";
  const status = taskStatus(task);
  const format = (value: string | null, withTime = true) =>
    value ? formatDateTime(value, withTime, task.timezone, use12Hours) : "—";
  const edit = (field: InlineTaskField, label: string, children: ReactNode) => (
    <InlineProperty field={field} label={label} task={task} editor={editor}>
      {children}
    </InlineProperty>
  );
  return (
    <aside
      aria-label="Task properties"
      className="min-w-0 border-y py-5 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:border-y-0 xl:border-l xl:py-0 xl:pl-6"
    >
      <h2 className="mb-4 text-sm font-semibold">Properties</h2>
      <dl className="space-y-3">
        <Property label="Status" icon={<Circle />}>
          <InlineTaskStatus
            task={task}
            disabled={editor.active !== null || editor.pending || editor.blocked}
            onChanged={onChanged}
            editor={editor}
          >
            {status === "Overdue" ? (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                {status}
              </Badge>
            ) : (
              <span>{status}</span>
            )}
          </InlineTaskStatus>
        </Property>
        <Property label="Priority" icon={<ListFilter />}>
          {edit("priority", "Priority", <PriorityBadge priority={task.priority} />)}
        </Property>
        <Property label="Project" icon={<Folder />}>
          {edit("project", "Project", task.project.title)}
        </Property>
        <Property label="Type" icon={<Repeat2 />}>
          {edit(
            "type",
            "Type",
            <span className="flex flex-wrap gap-1">
              {taskKindLabels(task).map((label) => (
                <Badge
                  key={label}
                  variant="outline"
                  className="h-auto whitespace-normal wrap-anywhere"
                >
                  {label}
                </Badge>
              ))}
            </span>,
          )}
        </Property>
        <Property label="Labels" icon={<Tags />}>
          {edit(
            "labels",
            "Labels",
            <span className="flex flex-wrap gap-1">
              {labels.length ? null : (
                <span className="text-muted-foreground">{emptyLabelsText}</span>
              )}
              {labels.map((label) => (
                <Badge
                  key={label.id}
                  variant="secondary"
                  className="h-auto whitespace-normal wrap-anywhere"
                >
                  {label.title}
                </Badge>
              ))}
            </span>,
          )}
        </Property>
        {task.isDone && task.doneAt ? (
          <Property label="Completed" icon={<CalendarDays />}>
            {format(task.doneAt)}
          </Property>
        ) : null}
        <Property label="Due" icon={<CalendarDays />}>
          {edit("due", "Due", format(task.dueAt, task.hasDueTime))}
        </Property>
        <Property label="Start" icon={<Clock3 />}>
          {edit("start", "Start", format(task.startAt))}
        </Property>
        <Property label="End" icon={<Clock3 />}>
          {edit("end", "End", format(task.endAt))}
        </Property>
        <Property label="Timezone" icon={<Clock3 />}>
          {task.timezone}
        </Property>
      </dl>
      {task.recurrenceRule ? (
        <p className="mt-5 border-t pt-4 text-sm leading-relaxed text-muted-foreground">
          Repeats every {task.recurrenceRule.interval} {task.recurrenceRule.unit.toLowerCase()} from{" "}
          {task.recurrenceRule.mode === "FROM_COMPLETION" ? "completion" : "the scheduled cycle"}.
        </p>
      ) : null}
      <fieldset disabled={editor.pending || editor.blocked || editor.active !== null}>
        <legend className="sr-only">Recurrence behavior</legend>
        <TaskRecurrenceSetting task={task} onChanged={onChanged} />
      </fieldset>
    </aside>
  );
}

function taskStatus(task: TaskDetail): string {
  if (task.completionOutcome === "SKIPPED") return "Skipped";
  if (task.isDone) return "Completed";
  if (task.isOverdue) return "Overdue";
  return "Open";
}

function Property({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-2 text-sm">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <span aria-hidden="true" className="shrink-0 [&>svg]:size-3.5">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="min-w-0 wrap-anywhere">{children}</dd>
    </div>
  );
}
