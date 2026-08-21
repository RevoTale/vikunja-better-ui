import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskDiagnosticsDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import { taskPriorityLabel } from "./task-priority";

export function TaskDiagnosticsPage({ taskId, returnTo }: { taskId: string; returnTo: string }) {
  const { data, loading, error } = useQuery(TaskDiagnosticsDocument, { variables: { id: taskId } });
  if (loading) return <p>Loading diagnostics…</p>;
  if (error)
    return (
      <p role="alert" className="text-destructive">
        {graphQLErrorMessage(error, "Diagnostics could not be loaded.")}
      </p>
    );
  const task = data?.taskDiagnostics;
  if (!task) return <p>Task not found.</p>;
  const rows = [
    ["Task ID", task.id],
    ["Project ID", task.projectId],
    ["Kind", task.kind],
    ["Done", String(task.isDone)],
    ["Done at", task.doneAt],
    ["Due at", task.dueAt],
    ["Start at", task.startAt],
    ["End at", task.endAt],
    ["Priority", taskPriorityLabel(task.priority)],
    ["Created", task.createdAt],
    ["Updated", task.updatedAt],
    ["Permission", task.maxPermission],
  ];
  return (
    <section>
      <Link
        to="/tasks/$taskId"
        params={{ taskId }}
        search={{ returnTo }}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4 px-0")}
      >
        <ArrowLeft /> Back to task
      </Link>
      <h1 className="font-serif text-3xl font-semibold">Extended properties</h1>
      <p className="mt-1 text-sm text-muted-foreground">Read-only Vikunja-source diagnostics.</p>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            <h2>{task.title}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {rows.map(([label, value]) => (
              <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]" key={label}>
                <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                <dd className="break-all font-mono text-sm">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t pt-3">
            <p className="text-sm font-medium text-muted-foreground">Labels</p>
            <p className="mt-1 text-sm">
              {task.labels.map((label) => `${label.title} (#${label.id})`).join(", ") || "—"}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
