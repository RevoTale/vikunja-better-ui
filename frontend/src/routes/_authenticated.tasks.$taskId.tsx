import { createFileRoute, Outlet } from "@tanstack/react-router";

import { positiveID, safeReturnTo } from "@/app/route-search";

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  parseParams: (params) => ({ taskId: positiveID(params.taskId) }),
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: safeReturnTo(search["returnTo"]),
  }),
  component: Outlet,
});
