import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { ActiveWorkOrderControls, parseActiveSearch } from "@/features/tasks/active-work-order";
import { parseListSearch } from "@/features/tasks/list-search";
import { TaskListPage } from "@/features/tasks/task-list-page";

export const Route = createFileRoute("/_authenticated/active")({
  validateSearch: parseActiveSearch,
  component: Page,
});
function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <TaskListPage
      title="Active work"
      description="Available to work on now. Complete each task when its whole result is finished."
      scope="ACTIVE"
      activeOrder={{ sort: search.sort ?? "END_ASC", revisitFirst: Boolean(search.revisitFirst) }}
      search={search}
      setSearch={(next) => navigate({ search: next })}
      navigation={
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <ActiveWorkOrderControls
            search={search}
            onChange={(next) => navigate({ search: next })}
          />
          <Link
            to="/plan"
            search={{ ...parseListSearch(search), period: "month", page: 1 }}
            className={buttonVariants({ variant: "outline" })}
          >
            Finish in period
          </Link>
        </div>
      }
    />
  );
}
