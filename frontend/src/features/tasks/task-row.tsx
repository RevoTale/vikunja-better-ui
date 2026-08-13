import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TaskListQuery } from "@/graphql/graphql";
import { cn } from "@/lib/cn";
import { formatDateTime } from "./format-date-time";
import { PriorityBadge } from "./priority-badge";
import { taskKindLabel } from "./task-kind-label";
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
  return (
    <Card className={cn(task.isOverdue && "border-destructive/50 bg-destructive/5")}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/tasks/$taskId"
              params={{ taskId: task.id }}
              search={{ returnTo }}
              className="font-medium hover:underline"
            >
              {task.title}
            </Link>
            <KindBadge task={task} />
            {task.priority !== "UNSET" ? <PriorityBadge priority={task.priority} /> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {task.project.title}
            {task.dueAt
              ? ` · ${formatDateTime(task.dueAt, task.hasDueTime, task.timezone)}`
              : " · No deadline"}
            {task.isOverdue ? " · Overdue" : ""}
          </p>
          {labels.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Labels">
              {labels.map((label) => (
                <li
                  key={label.id}
                  className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {label.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {!task.isDone && task.kind !== "INVALID" ? (
          <Button
            className="shrink-0 self-center"
            size="icon"
            variant="outline"
            aria-label={`Complete ${task.title}`}
            disabled={completingTaskID === task.id}
            onClick={() => onComplete(task)}
          >
            <Check />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function KindBadge({ task }: { task: TaskItem }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-[0.7rem] font-medium">
      {taskKindLabel(task)}
    </span>
  );
}
