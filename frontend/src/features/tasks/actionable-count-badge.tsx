import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { cn } from "@/lib/utils";

export type ActionableCountState = {
  count: number | undefined;
  loading: boolean;
  error?: unknown;
};

export function ActionableCountBadge({ count, loading, error }: ActionableCountState) {
  const pending = loading || (count === undefined && !error);
  const label = pending
    ? "Updating tasks ready now"
    : error
      ? "Task count unavailable"
      : `${count} tasks ready now`;
  return (
    <span
      role="img"
      data-slot="actionable-count"
      aria-label={label}
      aria-busy={pending}
      title={`${label}. Unfinished tasks that are overdue or have reached Start from. All projects.`}
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[0.625rem] font-semibold text-foreground tabular-nums",
        !pending && !error && count === 0 && "invisible",
      )}
    >
      {pending ? (
        <LoadingPlaceholder className="h-2.5 w-3 bg-muted-foreground/30" />
      ) : error ? (
        "?"
      ) : (
        count
      )}
    </span>
  );
}
