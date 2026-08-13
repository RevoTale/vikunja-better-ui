import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { parseListSearch } from "@/features/tasks/list-search";
import { TaskListPage } from "@/features/tasks/task-list-page";
export const Route = createFileRoute("/_authenticated/unscheduled")({
  validateSearch: parseListSearch,
  component: Page,
});
function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <TaskListPage
      title="Tasks without deadline"
      description="Long-running work grouped by project."
      scope="UNSCHEDULED"
      search={search}
      setSearch={(next) => navigate({ search: next })}
    />
  );
}
