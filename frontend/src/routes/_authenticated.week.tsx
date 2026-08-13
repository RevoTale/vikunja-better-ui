import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { parseListSearch } from "@/features/tasks/list-search";
import { TaskListPage } from "@/features/tasks/task-list-page";
export const Route = createFileRoute("/_authenticated/week")({
  validateSearch: parseListSearch,
  component: Page,
});
function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <TaskListPage
      title="This week"
      description="Overdue tasks and everything due this week."
      scope="WEEK"
      search={search}
      setSearch={(next) => navigate({ search: next })}
    />
  );
}
