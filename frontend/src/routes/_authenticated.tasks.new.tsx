import { createFileRoute } from "@tanstack/react-router";

import { creationDate, creationProjectID, creationType, safeReturnTo } from "@/app/route-search";
import { CreateTaskPage } from "@/features/tasks/create-task-page";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  validateSearch: (search: Record<string, unknown>) => {
    const initialDate = creationDate(search["date"]);
    const projectID = creationProjectID(search["project"]);
    return {
      type: creationType(search["type"]),
      returnTo: safeReturnTo(search["returnTo"]),
      ...(initialDate ? { date: initialDate } : {}),
      ...(projectID ? { project: projectID } : {}),
    };
  },
  component: Page,
});

function Page() {
  return <CreateTaskPage {...Route.useSearch()} />;
}
