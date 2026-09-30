import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { cn } from "@/lib/utils";

export type ActionableCountState = {
  count: number | undefined;
  loading: boolean;
  error?: unknown;
};

export function ActionableCountBadge({ count, loading, error }: ActionableCountState) {
  const pending = loading || (count === undefined && !error);
  const label = countLabel(count, pending, error);
  return (
    <span
      role="img"
      data-slot="actionable-count"
      aria-label={label}
      aria-busy={pending}
      title={`${label}. Unfinished tasks that are overdue or have reached Start from. All projects.`}
      className={cn(
        "flex h-5 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[0.625rem] font-semibold text-foreground tabular-nums",
        pending && count !== undefined && "text-muted-foreground",
        !error && count === 0 && "invisible",
      )}
    >
      {pending && count === undefined ? (
        <LoadingPlaceholder className="h-2.5 w-3 bg-muted-foreground/30" />
      ) : error && !pending ? (
        "?"
      ) : (
        count !== undefined && (count > 999 ? "999+" : count)
      )}
    </span>
  );
}

function countLabel(count: number | undefined, pending: boolean, error: unknown) {
  if (pending) {
    return `Updating tasks ready now${count === undefined ? "" : `; last known count: ${count}`}`;
  }
  return error ? "Task count unavailable" : `${count} tasks ready now`;
}
