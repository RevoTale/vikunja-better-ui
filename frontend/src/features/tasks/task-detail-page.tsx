import { useQuery } from "@apollo/client/react";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { lazy, Suspense } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { TaskDetailsDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import { TaskDescription } from "./task-description";
import { TaskDetailActions } from "./task-detail-actions";
import { TaskProperties } from "./task-properties";

const DiscussionThread = lazy(() =>
  import("@/features/task-discussion/discussion-thread").then((module) => ({
    default: module.DiscussionThread,
  })),
);

export function TaskDetailPage({ taskId, returnTo }: { taskId: string; returnTo: string }) {
  const { data, loading, error, refetch } = useQuery(TaskDetailsDocument, {
    variables: { id: taskId },
  });
  if (loading && !data) return <p role="status">Loading task…</p>;
  const failure = error ? (
    <div role="alert" className="mb-4 text-destructive">
      <p>{graphQLErrorMessage(error, "Task could not be loaded.")}</p>
      <Button variant="outline" onClick={() => void refetch().catch(() => undefined)}>
        Retry task
      </Button>
    </div>
  ) : null;
  const task = data?.task;
  if (!task) return failure ?? <p>Task not found.</p>;
  return (
    <section className="mx-auto max-w-6xl min-w-0">
      {failure}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <a href={returnTo} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-0")}>
          <ArrowLeft /> Back
        </a>
        <TaskDetailActions task={task} returnTo={returnTo} onChanged={() => refetch()} />
      </div>
      <div className="grid min-w-0 gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 xl:col-start-1">
          <header className="space-y-3">
            <p className="text-xs text-muted-foreground wrap-anywhere">
              {task.project.title} <span aria-hidden="true">/</span> Task #{task.id}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight wrap-anywhere sm:text-3xl">
              {task.title}
            </h1>
          </header>
          <TaskDescription description={task.description} />
        </div>
        <TaskProperties task={task} onChanged={() => refetch()} />
        <section aria-label="Discussion" className="min-w-0 space-y-5 border-t pt-6 xl:col-start-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare aria-hidden="true" className="size-4 text-muted-foreground" /> Discussion
          </h2>
          <Suspense fallback={<p role="status">Loading discussion…</p>}>
            <DiscussionThread key={taskId} taskId={taskId} />
          </Suspense>
        </section>
      </div>
    </section>
  );
}
