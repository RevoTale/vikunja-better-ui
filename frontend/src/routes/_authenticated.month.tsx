import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseListSearch } from "@/features/tasks/list-search";
export const Route = createFileRoute("/_authenticated/month")({
  validateSearch: parseListSearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/week", search: { project: search.project }, replace: true });
  },
});
