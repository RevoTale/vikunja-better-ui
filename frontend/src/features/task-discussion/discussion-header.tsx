import { useQuery } from "@apollo/client/react";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/features/tasks/format-date-time";
import { TaskDetailsDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";

export function DiscussionHeader({ taskId }: { taskId: string }) {
  const { data, loading, error, refetch } = useQuery(TaskDetailsDocument, {
    variables: { id: taskId },
  });
  const task = data?.task;
  return (
    <header>
      <h1 className="font-serif text-3xl font-semibold">Discussion</h1>
      {task ? (
        <>
          <h2 className="mt-2 break-words text-lg font-medium">{task.title}</h2>
          <p className="text-sm text-muted-foreground">
            {task.project.title} · {task.isDone ? "Completed" : "Open"}
            {task.dueAt
              ? ` · Due ${formatDateTime(task.dueAt, task.hasDueTime, task.timezone)}`
              : ""}
          </p>
        </>
      ) : loading ? (
        <div role="status" aria-label="Loading task context" className="mt-2 space-y-2">
          <LoadingPlaceholder className="h-7 w-2/3" />
          <LoadingPlaceholder className="h-5 w-1/2" />
        </div>
      ) : (
        <p>Task context unavailable.</p>
      )}
      {error ? (
        <>
          <p role="alert">{graphQLErrorMessage(error, "Task could not be loaded.")}</p>
          <Button
            variant="outline"
            onClick={() => {
              void refetch().catch(() => undefined);
            }}
          >
            Retry task
          </Button>
        </>
      ) : null}
    </header>
  );
}
