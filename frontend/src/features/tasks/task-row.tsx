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
      <CardContent className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-3 p-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:p-4">
        <Schedule schedule={schedule} priority={task.priority} />
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
          </div>
          {!task.isDone && task.kind !== "INVALID" ? (
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
          <span
            className="col-span-2 min-w-0 truncate text-xs text-muted-foreground"
            data-slot="task-project"
            title={task.project.title}
          >
            {task.project.title}
          </span>
          <TaskMetadata className="col-span-2" task={task} labels={labels} />
        </div>
      </CardContent>
    </Card>
  );
}

function Schedule({
  schedule,
  priority,
}: {
  schedule: ReturnType<typeof taskSchedule>;
  priority: TaskItem["priority"];
}) {
  return (
    <div className={cn("min-w-0", urgencyClassName(schedule.urgency))} data-slot="task-schedule">
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
  className,
  task,
  labels,
}: {
  className?: string;
  task: TaskItem;
  labels: ReadonlyArray<TaskItem["labels"][number]>;
}) {
  return (
    <ul
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
      aria-label="Task type and labels"
      data-slot="task-metadata"
    >
      <li className="min-w-0 max-w-full">
        <Badge
          className="max-w-full whitespace-normal wrap-anywhere text-left leading-tight"
          variant="outline"
        >
          {taskKindLabel(task)}
        </Badge>
      </li>
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
    </ul>
  );
}
