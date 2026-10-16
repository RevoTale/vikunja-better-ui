import { createFileRoute } from "@tanstack/react-router";

import { creationDate, creationProjectID, creationType, safeReturnTo } from "@/app/route-search";
import { CreateTaskPage } from "@/features/tasks/create-task-page";
import { parseTaskPriority } from "@/features/tasks/task-priority";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  validateSearch: (search: Record<string, unknown>) => {
    const initialDate = creationDate(search["date"]);
    const projectID = creationProjectID(search["project"]);
    const labelID = creationProjectID(search["label"]);
    const priority = parseTaskPriority(search["priority"]);
    return {
      type: creationType(search["type"]),
      returnTo: safeReturnTo(search["returnTo"]),
      ...(initialDate ? { date: initialDate } : {}),
      ...(projectID ? { project: projectID } : {}),
      ...(labelID ? { label: labelID } : {}),
      ...(priority ? { priority } : {}),
    };
  },
  component: Page,
});

function Page() {
  return <CreateTaskPage {...Route.useSearch()} />;
}
