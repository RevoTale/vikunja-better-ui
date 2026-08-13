import { createFileRoute } from "@tanstack/react-router";

import { creationType, safeReturnTo } from "@/app/route-search";
import { CreateTaskPage } from "@/features/tasks/create-task-page";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: creationType(search.type),
    returnTo: safeReturnTo(search.returnTo),
  }),
  component: Page,
});

function Page() {
  return <CreateTaskPage {...Route.useSearch()} />;
}
