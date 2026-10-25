import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, MessageSquare } from "lucide-react";
import { lazy, Suspense } from "react";
import { LoadFailure } from "@/components/load-failure";
import { buttonVariants } from "@/components/ui/button";
import { CommentsLoading } from "@/features/task-discussion/discussion-loading";
import { TaskDetailsDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import { InlineEditorFeedback } from "./inline-editor-actions";
import { InlineTaskContent } from "./inline-task-content";
import type { InlineTask } from "./inline-task-input";
import { TaskDetailActions } from "./task-detail-actions";
import { TaskDetailCompletion } from "./task-detail-completion";
import { TaskDetailLoading } from "./task-detail-loading";
import { TaskProperties } from "./task-properties";
import { TaskRelationships } from "./task-relationships";
import { useInlineTaskEditing } from "./use-inline-task-editing";

const DiscussionThread = lazy(() =>
  import("@/features/task-discussion/discussion-thread").then((module) => ({
    default: module.DiscussionThread,
  })),
);

export function TaskDetailPage({ taskId, returnTo }: { taskId: string; returnTo: string }) {
  const { data, loading, error, refetch } = useQuery(TaskDetailsDocument, {
    variables: { id: taskId },
  });
  if (loading && !data) return <TaskDetailLoading />;
  const failure = error ? (
    <LoadFailure className="mb-4" onRetry={() => void refetch().catch(() => undefined)}>
      {graphQLErrorMessage(error, "Task could not be loaded.")}
    </LoadFailure>
  ) : null;
  const task = data?.task;
  if (!task) return failure ?? <p>Task not found.</p>;
  return (
    <TaskDetailContent
      key={taskId}
      task={task}
      returnTo={returnTo}
      refetch={() => refetch()}
      failure={failure}
    />
  );
}

function TaskDetailContent({
  task,
  returnTo,
  refetch,
  failure,
}: {
  task: InlineTask;
  returnTo: string;
  refetch: () => Promise<unknown>;
  failure: React.ReactNode;
}) {
  const editor = useInlineTaskEditing(task, refetch);
  return (
    <section className="mx-auto max-w-6xl min-w-0">
      {failure}
      {editor.active === null || editor.active === "title" || editor.active === "description" ? (
        <InlineEditorFeedback editor={editor} />
      ) : null}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <a href={returnTo} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-0")}>
          <ArrowLeft /> Back
        </a>
        <div className="flex w-full max-w-full flex-wrap items-start gap-2 sm:w-auto">
          <TaskDetailCompletion task={task} editor={editor} onChanged={refetch} />
          <div inert={editor.active !== null || editor.pending || editor.blocked}>
            <TaskDetailActions
              task={task}
              returnTo={returnTo}
              onChanged={refetch}
              runAction={editor.runAction}
            />
          </div>
        </div>
      </div>
      <div className="grid min-w-0 gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 lg:col-start-1">
          <header className="space-y-3">
            <p className="text-xs text-muted-foreground wrap-anywhere">
              {task.project.title} <span aria-hidden="true">/</span> Task #{task.id}
            </p>
            <InlineTaskContent task={task} editor={editor} />
          </header>
        </div>
        <TaskProperties task={task} editor={editor} onChanged={refetch} />
        <section aria-label="Task relationships" className="min-w-0 lg:col-start-1">
          <TaskRelationships key={task.id} parent={task} />
        </section>
        <section aria-label="Discussion" className="min-w-0 space-y-4 border-t pt-5 lg:col-start-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <MessageSquare aria-hidden="true" className="size-4 text-muted-foreground" />{" "}
              Discussion
            </h2>
            <Link
              to="/tasks/$taskId/discussion"
              params={{ taskId: task.id }}
              search={{ returnTo }}
              aria-label="Discussion"
              className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Open separately <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
          {task.recurrenceRule ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              This discussion belongs to the whole series. Completing an occurrence keeps these
              comments.
            </p>
          ) : null}
          {task.isDone ? (
            <p className="text-xs text-muted-foreground">
              Task details are read-only. You can still use the discussion below.
            </p>
          ) : null}
          <Suspense fallback={<CommentsLoading />}>
            <DiscussionThread key={task.id} taskId={task.id} />
          </Suspense>
        </section>
      </div>
    </section>
  );
}
