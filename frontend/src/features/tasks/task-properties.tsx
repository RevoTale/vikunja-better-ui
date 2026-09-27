import { CalendarDays, Circle, Clock3, Folder, ListFilter, Repeat2, Tags } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { TaskDetailsQuery } from "@/graphql/graphql";
import { formatDateTime } from "./format-date-time";
import { PriorityBadge } from "./priority-badge";
import { taskKindLabels } from "./task-kind-label";
import { TaskRecurrenceSetting } from "./task-recurrence-setting";
import { visibleTaskLabels } from "./visible-task-labels";

type TaskDetail = NonNullable<TaskDetailsQuery["task"]>;

export function TaskProperties({
  task,
  onChanged,
}: {
  task: TaskDetail;
  onChanged: () => Promise<unknown>;
}) {
  const labels = visibleTaskLabels(task.labels);
  const status =
    task.completionOutcome === "SKIPPED"
      ? "Skipped"
      : task.isDone
        ? "Completed"
        : task.isOverdue
          ? "Overdue"
          : "Open";
  const format = (value: string | null, withTime = true) =>
    value ? formatDateTime(value, withTime, task.timezone) : "—";
  return (
    <aside
      aria-label="Task properties"
      className="min-w-0 border-y py-5 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:border-y-0 xl:border-l xl:py-0 xl:pl-6"
    >
      <h2 className="mb-4 text-sm font-semibold">Properties</h2>
      <dl className="space-y-3">
        <Property label="Status" icon={<Circle />}>
          {status === "Overdue" ? (
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              {status}
            </Badge>
          ) : (
            <span>{status}</span>
          )}
        </Property>
        <Property label="Priority" icon={<ListFilter />}>
          <PriorityBadge priority={task.priority} />
        </Property>
        <Property label="Project" icon={<Folder />}>
          {task.project.title}
        </Property>
        <Property label="Type" icon={<Repeat2 />}>
          <div className="flex flex-wrap gap-1">
            {taskKindLabels(task).map((label) => (
              <Badge
                key={label}
                variant="outline"
                className="h-auto whitespace-normal wrap-anywhere"
              >
                {label}
              </Badge>
            ))}
          </div>
        </Property>
        {labels.length ? (
          <Property label="Labels" icon={<Tags />}>
            <div className="flex flex-wrap gap-1">
              {labels.map((label) => (
                <Badge
                  key={label.id}
                  variant="secondary"
                  className="h-auto whitespace-normal wrap-anywhere"
                >
                  {label.title}
                </Badge>
              ))}
            </div>
          </Property>
        ) : null}
        {task.isDone && task.doneAt ? (
          <Property label="Completed" icon={<CalendarDays />}>
            {format(task.doneAt)}
          </Property>
        ) : null}
        <Property label="Due" icon={<CalendarDays />}>
          {format(task.dueAt, task.hasDueTime)}
        </Property>
        {task.startAt ? (
          <Property label="Start" icon={<Clock3 />}>
            {format(task.startAt)}
          </Property>
        ) : null}
        {task.endAt ? (
          <Property label="End" icon={<Clock3 />}>
            {format(task.endAt)}
          </Property>
        ) : null}
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
      <TaskRecurrenceSetting task={task} onChanged={onChanged} />
    </aside>
  );
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
