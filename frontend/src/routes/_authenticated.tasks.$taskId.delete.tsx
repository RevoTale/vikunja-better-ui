import { createFileRoute } from "@tanstack/react-router";

import { safeReturnTo } from "@/app/route-search";
import { DeleteTaskPage } from "@/features/tasks/delete-task-page";

export const Route = createFileRoute("/_authenticated/tasks/$taskId/delete")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: safeReturnTo(search["returnTo"]),
  }),
  component: Page,
});

function Page() {
  return <DeleteTaskPage taskId={Route.useParams().taskId} returnTo={Route.useSearch().returnTo} />;
}
