import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { cn } from "@/lib/utils";

type CountBadgeProps = {
  to: "/today" | "/active";
  count: number | undefined;
  loading: boolean;
  error?: unknown;
};

const badgeText = {
  "/today": {
    slot: "actionable-count",
    singular: "task to finish today",
    unit: "tasks to finish today",
    unavailable: "Task count unavailable",
    detail:
      "Planned finishes and deadlines through today, including earlier unfinished work. All projects.",
  },
  "/active": {
    slot: "active-work-count",
    singular: "active task",
    unit: "active tasks",
    unavailable: "Active work count unavailable",
    detail: "All accessible projects, across all pages.",
  },
};

function badgeLabel(
  text: (typeof badgeText)[keyof typeof badgeText],
  count: number | undefined,
  pending: boolean,
  error: unknown,
) {
  if (pending) {
    const updating = `Updating ${text.unit}`;
    return count === undefined ? updating : `${updating}; last known count: ${count}`;
  }
  if (error) return text.unavailable;
  return `${count} ${count === 1 ? text.singular : text.unit}`;
}

export function NavigationCountBadge({ to, count, loading, error }: CountBadgeProps) {
  const pending = loading || (count === undefined && !error);
  const text = badgeText[to];
  const label = badgeLabel(text, count, pending, error);
  return (
    <span
      role="img"
      data-slot={text.slot}
      aria-label={label}
      aria-busy={pending}
      title={`${label}. ${text.detail}`}
      className={cn(
        "flex h-5 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[0.625rem] font-semibold text-foreground tabular-nums",
        pending && count !== undefined && "text-muted-foreground",
        to === "/today" && !error && count === 0 && "invisible",
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
