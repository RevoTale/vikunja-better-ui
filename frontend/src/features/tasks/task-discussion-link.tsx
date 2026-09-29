import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import type { TaskItem } from "./task-row";

export function TaskDiscussionLink({
  task,
  returnTo,
  loading,
}: {
  task: Pick<TaskItem, "id" | "title" | "commentCount">;
  returnTo: string;
  loading: boolean;
}) {
  const count = task.commentCount;
  if (count === 0 || (count == null && !loading)) return null;
  return (
    <div className="mr-auto shrink-0" data-slot="task-discussion">
      <Link
        to="/tasks/$taskId/discussion"
        params={{ taskId: task.id }}
        search={{ returnTo }}
        className="inline-flex min-h-6 min-w-6 items-center justify-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={
          loading
            ? `Discussion on ${task.title}; updating count`
            : `${count} ${count === 1 ? "comment" : "comments"} on ${task.title}`
        }
      >
        <MessageSquare className="size-3.5" aria-hidden="true" />
        {loading ? (
          <span role="status" aria-label="Updating comment count">
            <LoadingPlaceholder className="h-3 w-4" />
          </span>
        ) : (
          <span className="tabular-nums">{count}</span>
        )}
      </Link>
    </div>
  );
}
