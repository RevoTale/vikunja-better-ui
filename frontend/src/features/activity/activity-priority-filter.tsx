import { Button } from "@/components/ui/button";
import { taskPriorityOptions } from "@/features/tasks/task-priority";
import type { TaskPriority } from "@/graphql/graphql";
import { cn } from "@/lib/utils";

export const allActivityPriorities = taskPriorityOptions.map((option) => option.value);

export function ActivityPriorityFilter({
  selected,
  onChange,
}: {
  selected: readonly TaskPriority[];
  onChange: (priorities: TaskPriority[]) => void;
}) {
  const excluded = allActivityPriorities.length - selected.length;
  return (
    <fieldset className="min-w-0 space-y-3 rounded-lg border bg-card p-3 sm:p-4">
      <legend className="px-1 text-sm font-semibold">Included priorities</legend>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-xl text-xs text-muted-foreground">
          Checked priorities are included. Unchecked priorities are excluded from every chart.
        </p>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={selected.length === allActivityPriorities.length}
            onClick={() => onChange(allActivityPriorities)}
          >
            Include all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={selected.length === 0}
            onClick={() => onChange([])}
          >
            Exclude all
          </Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {taskPriorityOptions.map((option) => {
          const included = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                included
                  ? "border-primary/35 bg-primary/8"
                  : "border-border bg-muted/30 text-muted-foreground",
              )}
            >
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-primary"
                checked={included}
                aria-label={`${option.label}: ${included ? "included" : "excluded"}`}
                onChange={() =>
                  onChange(
                    included
                      ? selected.filter((priority) => priority !== option.value)
                      : [...selected, option.value],
                  )
                }
              />
              <span>{option.label}</span>
              <span className="ml-auto text-xs">{included ? "Included" : "Excluded"}</span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {selected.length} included · {excluded} excluded
      </p>
    </fieldset>
  );
}
