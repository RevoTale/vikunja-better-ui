import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { parseListSearch } from "@/features/tasks/list-search";
import { TaskListPage } from "@/features/tasks/task-list-page";
export const Route = createFileRoute("/_authenticated/today")({
  validateSearch: parseListSearch,
  component: Page,
});
function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <TaskListPage
      title="Today"
      description="Due now or before the end of today."
      scope="TODAY"
      search={search}
      setSearch={(next) => navigate({ search: next })}
    />
  );
}
