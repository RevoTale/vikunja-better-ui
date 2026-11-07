import { LoadingPlaceholder } from "@/components/loading-placeholder";
import type { TaskListQuery, TaskScope } from "@/graphql/graphql";

export function ActiveWorkCount({
  page,
  loading,
  error,
  scope = "ACTIVE",
}: {
  page: Pick<TaskListQuery["tasks"], "isComplete" | "totalItems"> | undefined;
  loading: boolean;
  error: unknown;
  scope?: TaskScope;
}) {
  if (scope !== "ACTIVE") return null;
  const count = page?.isComplete ? page.totalItems : undefined;
  const label = loading ? "Updating active work count" : "Active work count unavailable";
  return (
    <span
      role="img"
      className="inline-flex min-w-8 items-center justify-center rounded-full bg-muted px-2 py-1 font-sans text-sm font-medium tabular-nums"
      aria-label={
        loading || error || count === undefined
          ? label
          : `${count} active tasks matching current filters`
      }
      aria-busy={loading}
      title="All active tasks matching current filters, across all pages"
    >
      {loading ? (
        <LoadingPlaceholder className="h-4 w-4" />
      ) : error || count === undefined ? (
        "—"
      ) : (
        count
      )}
    </span>
  );
}
