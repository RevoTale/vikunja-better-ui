import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { WeekPage } from "@/features/tasks/week-page";
import { parseWeekSearch } from "@/features/tasks/week-search";
export const Route = createFileRoute("/_authenticated/week")({
  validateSearch: parseWeekSearch,
  component: Page,
});
function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return <WeekPage search={search} setSearch={(next) => navigate({ search: next })} />;
}
