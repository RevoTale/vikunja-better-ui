import { useQuery } from "@apollo/client/react";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { lazy, Suspense } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { CommentsLoading } from "@/features/task-discussion/discussion-loading";
import { TaskDetailsDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import { InlineEditorFeedback } from "./inline-editor-actions";
import { InlineTaskContent } from "./inline-task-content";
import type { InlineTask } from "./inline-task-input";
import { TaskDetailActions } from "./task-detail-actions";
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
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <a href={returnTo} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-0")}>
          <ArrowLeft /> Back
        </a>
        <div inert={editor.active !== null || editor.pending || editor.blocked}>
          <TaskDetailActions task={task} returnTo={returnTo} onChanged={refetch} />
        </div>
      </div>
      <div className="grid min-w-0 gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 xl:col-start-1">
          <header className="space-y-3">
            <p className="text-xs text-muted-foreground wrap-anywhere">
              {task.project.title} <span aria-hidden="true">/</span> Task #{task.id}
            </p>
            <InlineTaskContent task={task} editor={editor} />
          </header>
          <TaskRelationships key={task.id} parent={task} />
        </div>
        <TaskProperties task={task} editor={editor} onChanged={refetch} />
        <section aria-label="Discussion" className="min-w-0 space-y-5 border-t pt-6 xl:col-start-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare aria-hidden="true" className="size-4 text-muted-foreground" /> Discussion
          </h2>
          <Suspense fallback={<CommentsLoading />}>
            <DiscussionThread key={task.id} taskId={task.id} />
          </Suspense>
        </section>
      </div>
    </section>
  );
}
