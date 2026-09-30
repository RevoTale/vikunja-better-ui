import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import type { TaskItem } from "./task-row";

export function TaskDiscussionPlaceholder() {
  return (
    <div className="mr-auto flex h-6 w-16 shrink-0 items-center" data-slot="task-count-placeholder">
      <LoadingPlaceholder className="h-3 w-full" />
    </div>
  );
}

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
  if (count === 0 || (count == null && !loading)) {
    return <div className="mr-auto h-6 w-16 shrink-0" aria-hidden="true" />;
  }
  const label =
    count == null
      ? `Discussion on ${task.title}; updating count`
      : `${count} ${count === 1 ? "comment" : "comments"} on ${task.title}${loading ? "; updating count" : ""}`;
  return (
    <div className="mr-auto flex shrink-0" data-slot="task-discussion">
      <Link
        to="/tasks/$taskId/discussion"
        params={{ taskId: task.id }}
        search={{ returnTo }}
        className="inline-flex h-6 w-16 items-center justify-between rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={label}
        aria-busy={loading}
        title={label}
      >
        <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
        {count == null ? (
          <span role="status" aria-label="Updating comment count">
            <LoadingPlaceholder className="h-3 w-12" />
          </span>
        ) : (
          <span className="w-12 text-center tabular-nums">{count > 999 ? "999+" : count}</span>
        )}
      </Link>
    </div>
  );
}
