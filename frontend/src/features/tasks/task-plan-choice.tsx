import { Button } from "@/components/ui/button";

export function TaskPlanChoice<Value extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: Value; label: string }[];
  value: Value | null;
  onChange: (next: Value) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            variant={value === option.value ? "default" : "ghost"}
            className="h-auto min-h-11 min-w-0 whitespace-normal px-2"
            onClick={(event) => {
              if (option.value === value) return;
              const form = event.currentTarget.form;
              onChange(option.value);
              // A choice may update the effective dates used by form validation.
              queueMicrotask(() => form?.dispatchEvent(new Event("input", { bubbles: true })));
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

export function TaskFrequencyChoice({
  recurring,
  onChange,
}: {
  recurring: boolean;
  onChange: (recurring: boolean) => void;
}) {
  return (
    <TaskPlanChoice
      legend="How often will you do this?"
      options={
        [
          { value: "once", label: "Do once" },
          { value: "repeat", label: "Repeat" },
        ] as const
      }
      value={recurring ? "repeat" : "once"}
      onChange={(next) => onChange(next === "repeat")}
    />
  );
}
