import { createFileRoute } from "@tanstack/react-router";

import { safeReturnTo } from "@/app/route-search";
import { TaskDiagnosticsPage } from "@/features/tasks/task-diagnostics-page";

export const Route = createFileRoute("/_authenticated/tasks/$taskId/extended")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: safeReturnTo(search["returnTo"]),
  }),
  component: Page,
});

function Page() {
  return (
    <TaskDiagnosticsPage taskId={Route.useParams().taskId} returnTo={Route.useSearch().returnTo} />
  );
}
