import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlanningPage } from "@/features/tasks/planning-page";
import { parsePlanningSearch } from "@/features/tasks/planning-search";

export const Route = createFileRoute("/_authenticated/plan")({
  validateSearch: parsePlanningSearch,
  component: Page,
});
function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return <PlanningPage search={search} setSearch={(next) => navigate({ search: next })} />;
}
