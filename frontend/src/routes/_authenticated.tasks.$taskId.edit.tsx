import { createFileRoute } from "@tanstack/react-router";
import { EditTaskPage } from "@/features/tasks/edit-task-page";

export const Route = createFileRoute("/_authenticated/tasks/$taskId/edit")({ component: Page });

function Page() {
  return <EditTaskPage taskId={Route.useParams().taskId} returnTo={Route.useSearch().returnTo} />;
}
