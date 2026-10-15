import { Button } from "@/components/ui/button";
import { taskPriorityOptions } from "@/features/tasks/task-priority";
import type { TaskPriority } from "@/graphql/graphql";

export const allActivityPriorities = taskPriorityOptions.map((option) => option.value);

export function ActivityPriorityFilter({
  selected,
  onChange,
}: {
  selected: readonly TaskPriority[];
  onChange: (priorities: TaskPriority[]) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">Priorities</legend>
      <div className="flex flex-wrap gap-2">
        {taskPriorityOptions.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={selected.includes(option.value) ? "secondary" : "outline"}
            aria-pressed={selected.includes(option.value)}
            onClick={() =>
              onChange(
                selected.includes(option.value)
                  ? selected.filter((priority) => priority !== option.value)
                  : [...selected, option.value],
              )
            }
          >
            {option.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => onChange(allActivityPriorities)}>
          All priorities
        </Button>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {selected.length
          ? "Select one or several priorities. Charts update without reloading."
          : "No priorities selected."}
      </p>
    </fieldset>
  );
}
