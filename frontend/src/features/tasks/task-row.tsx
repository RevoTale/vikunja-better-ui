import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TaskListQuery } from "@/graphql/graphql";
import { cn } from "@/lib/cn";
import { PriorityBadge } from "./priority-badge";
import { taskKindLabel } from "./task-kind-label";
import { type TaskUrgency, taskSchedule } from "./task-schedule";
import { visibleTaskLabels } from "./visible-task-labels";

export type TaskItem = TaskListQuery["tasks"]["items"][number];

export function TaskRow({
  task,
  returnTo,
  completingTaskID,
  onComplete,
}: {
  task: TaskItem;
  returnTo: string;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
}) {
  const labels = visibleTaskLabels(task.labels);
  const schedule = taskSchedule(task);
  return (
    <Card className={cn(task.isOverdue && "border-destructive/50 bg-destructive/5")}>
      <CardContent className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 p-3 sm:grid-cols-[8rem_minmax(0,1fr)_9rem] sm:gap-y-0 sm:p-4">
        <Schedule
          className="row-span-2 sm:row-span-1"
          schedule={schedule}
          priority={task.priority}
        />
        <div className="min-w-0" data-slot="task-content">
          <Link
            to="/tasks/$taskId"
            params={{ taskId: task.id }}
            search={{ returnTo }}
            className="font-medium hover:underline"
          >
            {task.title}
          </Link>
          {schedule.completeBy ? (
            <p className="mt-1 text-xs text-muted-foreground">{schedule.completeBy}</p>
          ) : null}
          <TaskMetadata task={task} labels={labels} />
        </div>
        <div
          className="col-start-2 row-start-2 flex min-w-0 items-end justify-between gap-2 self-stretch sm:col-start-auto sm:row-start-auto sm:flex-col sm:gap-3"
          data-slot="task-trailing"
        >
          <span
            className="min-w-0 flex-1 truncate text-xs text-muted-foreground sm:max-w-full sm:flex-none sm:text-right"
            data-slot="task-project"
            title={task.project.title}
          >
            {task.project.title}
          </span>
          {!task.isDone && task.kind !== "INVALID" ? (
            <Button
              className="shrink-0"
              size="icon"
              variant="outline"
              aria-label={`Complete ${task.title}`}
              disabled={completingTaskID === task.id}
              onClick={() => onComplete(task)}
            >
              <Check />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Schedule({
  className,
  schedule,
  priority,
}: {
  className?: string;
  schedule: ReturnType<typeof taskSchedule>;
  priority: TaskItem["priority"];
}) {
  return (
    <div
      className={cn("min-w-0", urgencyClassName(schedule.urgency), className)}
      data-slot="task-schedule"
    >
      <p className="text-sm font-semibold leading-tight">{schedule.date}</p>
      {schedule.time ? <p className="mt-1 whitespace-nowrap text-xs">{schedule.time}</p> : null}
      {schedule.status ? <p className="mt-1 text-xs font-medium">{schedule.status}</p> : null}
      {priority !== "UNSET" ? (
        <PriorityBadge className="mt-2 max-w-full" priority={priority} />
      ) : null}
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
  task,
  labels,
}: {
  task: TaskItem;
  labels: ReadonlyArray<TaskItem["labels"][number]>;
}) {
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Task type and labels">
      <li>
        <Badge variant="outline">{taskKindLabel(task)}</Badge>
      </li>
      {labels.map((label) => (
        <li key={label.id}>
          <Badge className="text-muted-foreground" variant="outline">
            {label.title}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
