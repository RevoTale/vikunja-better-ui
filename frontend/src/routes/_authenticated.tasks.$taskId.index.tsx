import { createFileRoute } from "@tanstack/react-router";

import { TaskDetailPage } from "@/features/tasks/task-detail-page";

export const Route = createFileRoute("/_authenticated/tasks/$taskId/")({ component: Page });

function Page() {
  return <TaskDetailPage taskId={Route.useParams().taskId} returnTo={Route.useSearch().returnTo} />;
}
