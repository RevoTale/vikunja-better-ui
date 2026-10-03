import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { parseDaySearch } from "@/features/tasks/day-search";
import { TodayPage } from "@/features/tasks/today-page";
export const Route = createFileRoute("/_authenticated/today")({
  validateSearch: parseDaySearch,
  component: Page,
});
function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return <TodayPage search={search} setSearch={(next) => navigate({ search: next })} />;
}
