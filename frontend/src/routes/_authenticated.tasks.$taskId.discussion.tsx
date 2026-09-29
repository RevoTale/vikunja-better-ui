import { createFileRoute } from "@tanstack/react-router";
import { creationProjectID } from "@/app/route-search";
import { DiscussionPage } from "@/features/task-discussion/discussion-page";

export const Route = createFileRoute("/_authenticated/tasks/$taskId/discussion")({
  validateSearch: (search: Record<string, unknown>): { comment?: string } => {
    const comment = creationProjectID(search["comment"]);
    return comment ? { comment } : {};
  },
  component: Page,
});

function Page() {
  const taskId = Route.useParams().taskId;
  const search = Route.useSearch();
  return (
    <DiscussionPage
      key={taskId}
      taskId={taskId}
      returnTo={search.returnTo}
      commentId={search.comment}
    />
  );
}
