import { useQuery } from "@apollo/client/react";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskDetailsDocument } from "@/graphql/graphql";
import { cn } from "@/lib/cn";
import { graphQLErrorMessage } from "@/lib/user-error";
import { formatDateTime } from "./format-date-time";
import { PriorityBadge } from "./priority-badge";
import { TaskDetailActions } from "./task-detail-actions";
import { taskKindLabel } from "./task-kind-label";

export function TaskDetailPage({ taskId, returnTo }: { taskId: string; returnTo: string }) {
  const { data, loading, error, refetch } = useQuery(TaskDetailsDocument, {
    variables: { id: taskId },
  });
  if (loading && !data) return <p>Loading task…</p>;
  if (error)
    return (
      <p role="alert" className="text-destructive">
        {graphQLErrorMessage(error, "Task could not be loaded.")}
      </p>
    );
  const task = data?.task;
  if (!task) return <p>Task not found.</p>;
  return (
    <section>
      <a
        href={returnTo}
        className={cn(buttonVariants({ variant: "ghost", size: "compact" }), "mb-4 px-0")}
      >
        <ArrowLeft /> Back
      </a>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {task.project.title} · {taskKindLabel(task)}
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold">{task.title}</h1>
        </div>
        <TaskDetailActions task={task} returnTo={returnTo} onChanged={() => refetch()} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Task</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Status" value={taskStatus(task)} />
            <Fact label="Priority" value={<PriorityBadge priority={task.priority} />} />
            {task.isDone && task.doneAt ? (
              <Fact label="Completed" value={format(task.doneAt, true, task.timezone)} />
            ) : null}
            <Fact label="Due" value={format(task.dueAt, task.hasDueTime, task.timezone)} />
            <Fact label="Start" value={format(task.startAt, true, task.timezone)} />
            <Fact label="End" value={format(task.endAt, true, task.timezone)} />
            <Fact label="Timezone" value={task.timezone} />
          </dl>
          {task.description ? (
            <div className="mt-6 whitespace-pre-wrap border-t pt-4 text-sm">{task.description}</div>
          ) : null}
          {task.recurrenceRule ? (
            <p className="mt-4 text-sm">
              Repeats every {task.recurrenceRule.interval} {task.recurrenceRule.unit.toLowerCase()}{" "}
              from{" "}
              {task.recurrenceRule.mode === "FROM_COMPLETION"
                ? "completion"
                : "the scheduled cycle"}
              .
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function taskStatus(task: {
  completionOutcome: "COMPLETED" | "SKIPPED" | null;
  isDone: boolean;
  isOverdue: boolean;
}): string {
  if (task.completionOutcome === "SKIPPED") return "Skipped";
  if (task.isDone) return "Completed";
  return task.isOverdue ? "Overdue" : "Open";
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}
function format(value: string | null, withTime: boolean, timezone: string) {
  return value ? formatDateTime(value, withTime, timezone) : "—";
}
