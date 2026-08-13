import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bug } from "lucide-react";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskDetailsDocument } from "@/graphql/graphql";
import { cn } from "@/lib/cn";
import { PriorityBadge } from "./priority-badge";
import { taskKindLabel } from "./task-kind-label";

export function TaskDetailPage({ taskId, returnTo }: { taskId: string; returnTo: string }) {
  const { data, loading, error } = useQuery(TaskDetailsDocument, { variables: { id: taskId } });
  if (loading) return <p>Loading task…</p>;
  if (error)
    return (
      <p role="alert" className="text-destructive">
        Task could not be loaded.
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
        <Link
          to="/tasks/$taskId/extended"
          params={{ taskId }}
          search={{ returnTo }}
          className={cn(buttonVariants({ variant: "outline", size: "compact" }))}
        >
          <Bug /> Extended
        </Link>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Task</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact
              label="Status"
              value={task.isDone ? "Completed" : task.isOverdue ? "Overdue" : "Open"}
            />
            <Fact label="Priority" value={<PriorityBadge priority={task.priority} />} />
            <Fact label="Due" value={format(task.dueAt)} />
            <Fact label="Start" value={format(task.startAt)} />
            <Fact label="End" value={format(task.endAt)} />
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

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}
function format(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}
