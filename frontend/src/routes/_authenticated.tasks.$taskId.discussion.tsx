import { createFileRoute } from "@tanstack/react-router";
import { DiscussionPage } from "@/features/task-discussion/discussion-page";

export const Route = createFileRoute("/_authenticated/tasks/$taskId/discussion")({
  component: Page,
});

function Page() {
  const taskId = Route.useParams().taskId;
  return <DiscussionPage key={taskId} taskId={taskId} returnTo={Route.useSearch().returnTo} />;
}
