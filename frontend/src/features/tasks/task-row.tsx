import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TaskListQuery } from "@/graphql/graphql";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "./priority-badge";
import { recurrenceHint } from "./recurrence-hint";
import { taskKindLabel } from "./task-kind-label";
import { type TaskUrgency, taskSchedule } from "./task-schedule";
import { visibleTaskLabels } from "./visible-task-labels";

export type TaskItem = TaskListQuery["tasks"]["items"][number];

export function TaskRow({
  task,
  returnTo,
  completingTaskID,
  onComplete,
  projection = false,
  showRecurrenceHint = false,
  dayGrouped = false,
}: {
  task: TaskItem;
  returnTo: string;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
  projection?: boolean;
  showRecurrenceHint?: boolean;
  dayGrouped?: boolean;
}) {
  const labels = visibleTaskLabels(task.labels);
  const schedule = taskSchedule(task);
  const hint = showRecurrenceHint ? recurrenceHint(task) : null;
  return (
    <Card
      className={cn(
        "py-0",
        task.isOverdue && "border-destructive/50 bg-destructive/5",
        projection && "border-dashed border-muted-foreground/30 bg-muted/40 text-muted-foreground",
      )}
      data-projection={projection || undefined}
    >
      <CardContent
        className={cn(
          "grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-3 px-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:px-4",
          dayGrouped ? "py-2 sm:py-3" : "py-3 sm:py-4",
        )}
      >
        <Schedule schedule={schedule} dayGrouped={dayGrouped} projection={projection} />
        <div
          className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2"
          data-slot="task-content"
        >
          <div className="min-w-0">
            <Link
              to="/tasks/$taskId"
              params={{ taskId: task.id }}
              search={{ returnTo }}
              className="block max-w-full wrap-anywhere font-medium hover:underline"
            >
              {task.title}
            </Link>
            {schedule.completeBy ? (
              <p className="mt-1 text-xs text-muted-foreground">{schedule.completeBy}</p>
            ) : null}
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          {!projection && !task.isDone && task.kind !== "INVALID" ? (
            <Button
              className="shrink-0 self-start"
              size="icon"
              variant="outline"
              aria-label={`Complete ${task.title}`}
              disabled={completingTaskID === task.id}
              onClick={() => onComplete(task)}
            >
              <Check />
            </Button>
          ) : null}
          <TaskMetadata
            className="col-span-2 justify-end"
            task={task}
            labels={labels}
            projection={projection}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Schedule({
  schedule,
  dayGrouped,
  projection,
}: {
  schedule: ReturnType<typeof taskSchedule>;
  dayGrouped: boolean;
  projection: boolean;
}) {
  const primary = dayGrouped ? (schedule.time ?? "Anytime") : schedule.date;
  return (
    <div
      className={cn(
        "min-w-0",
        projection ? "text-muted-foreground" : urgencyClassName(schedule.urgency),
      )}
      data-slot="task-schedule"
    >
      <p className="text-sm font-semibold leading-tight">{primary}</p>
      {!dayGrouped && schedule.time ? (
        <p className="mt-1 whitespace-nowrap text-xs">{schedule.time}</p>
      ) : null}
      {schedule.status ? <p className="mt-1 text-xs font-medium">{schedule.status}</p> : null}
    </div>
  );
}

function urgencyClassName(urgency: TaskUrgency): string {
  if (urgency === "overdue") return "text-destructive";
  if (urgency === "soon") return "text-amber-800 dark:text-amber-300";
  if (urgency === "muted") return "text-muted-foreground";
  return "text-foreground";
}

function TaskMetadata({
  className,
  task,
  labels,
  projection = false,
}: {
  className?: string;
  task: TaskItem;
  labels: ReadonlyArray<TaskItem["labels"][number]>;
  projection?: boolean;
}) {
  return (
    <ul
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
      aria-label="Task priority, labels, project, and type"
      data-slot="task-metadata"
    >
      {task.priority !== "UNSET" ? (
        <li className="min-w-0 max-w-full">
          <PriorityBadge className="max-w-full" priority={task.priority} />
        </li>
      ) : null}
      {projection ? (
        <li className="min-w-0 max-w-full">
          <Badge variant="secondary">Computed</Badge>
        </li>
      ) : null}
      {task.completionOutcome ? (
        <li className="min-w-0 max-w-full">
          <Badge variant={task.completionOutcome === "SKIPPED" ? "secondary" : "outline"}>
            {task.completionOutcome === "SKIPPED" ? "Skipped" : "Completed"}
          </Badge>
        </li>
      ) : null}
      {labels.map((label) => (
        <li className="min-w-0 max-w-full" key={label.id}>
          <Badge
            className="max-w-full whitespace-normal wrap-anywhere text-left leading-tight text-muted-foreground"
            variant="outline"
          >
            {label.title}
          </Badge>
        </li>
      ))}
      <li className="min-w-0 max-w-full" data-slot="task-project" title={task.project.title}>
        <Badge
          className="max-w-full whitespace-normal wrap-anywhere text-left leading-tight"
          variant="secondary"
        >
          Project: {task.project.title}
        </Badge>
      </li>
      <li className="min-w-0 max-w-full">
        <Badge
          className="max-w-full whitespace-normal wrap-anywhere text-left leading-tight"
          variant="outline"
        >
          {taskKindLabel(task)}
        </Badge>
      </li>
    </ul>
  );
}
