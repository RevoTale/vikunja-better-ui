import { Button } from "@/components/ui/button";
import type { TaskReminderInput } from "@/graphql/graphql";
import type { ReminderAnchor } from "./reminder-anchors";

export function RelativeReminderFields({
  input,
  anchors,
  onChange,
}: {
  input: TaskReminderInput;
  anchors: readonly ReminderAnchor[];
  onChange: (input: TaskReminderInput) => void;
}) {
  return (
    <div className="grid gap-2">
      <fieldset className="flex flex-wrap gap-2" aria-label="Remind me">
        {([-7200, -86400] as const).map((seconds) => (
          <Button
            key={seconds}
            type="button"
            size="sm"
            variant={input.relativePeriod === seconds ? "secondary" : "outline"}
            aria-pressed={input.relativePeriod === seconds}
            onClick={() =>
              onChange({ relativeTo: input.relativeTo ?? "", relativePeriod: seconds })
            }
          >
            {seconds === -7200 ? "2 hours before" : "1 day before"}
          </Button>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap items-center gap-2" aria-label="Reminder relative to">
        <span className="text-xs text-muted-foreground">Relative to</span>
        {anchors
          .filter((anchor) => anchor.available || anchor.value === input.relativeTo)
          .map((anchor) => (
            <Button
              key={anchor.value}
              type="button"
              size="sm"
              variant={input.relativeTo === anchor.value ? "secondary" : "outline"}
              aria-pressed={input.relativeTo === anchor.value}
              onClick={() =>
                onChange({ relativeTo: anchor.value, relativePeriod: input.relativePeriod ?? 0 })
              }
            >
              {anchor.label}
            </Button>
          ))}
      </fieldset>
      {!anchors.some((anchor) => anchor.value === input.relativeTo && anchor.available) && (
        <p className="text-xs text-muted-foreground">
          Inactive until this task date is set. Keep only one inactive reminder, or choose another
          date before saving.
        </p>
      )}
    </div>
  );
}
