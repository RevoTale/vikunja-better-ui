import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { DatePickerField } from "./date-picker-field";
import { type PlanningPeriod, planningRangeLabel } from "./planning-dates";
import type { PlanningSearch } from "./planning-search";

export function PlanningPeriodPicker({
  search,
  period,
  today,
  onChange,
}: {
  search: PlanningSearch;
  period: PlanningPeriod;
  today: string;
  onChange: (next: PlanningSearch) => void;
}) {
  return (
    <div className="mt-4 grid gap-3">
      <fieldset className="flex flex-wrap gap-2" aria-label="Completion period">
        {(
          [
            ["week", "This week"],
            ["month", "This month"],
            ["year", "This year"],
            ["custom", "Custom"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            variant={search.period === value ? "secondary" : "outline"}
            aria-pressed={search.period === value}
            onClick={() => {
              const { from: _from, through: _through, ...filters } = search;
              onChange({
                ...filters,
                period: value,
                ...(value === "custom" ? period : {}),
                page: 1,
              });
            }}
          >
            {label}
          </Button>
        ))}
      </fieldset>
      {search.period === "custom" ? (
        <div className="grid max-w-lg gap-3 sm:grid-cols-2">
          {(
            [
              ["from", "From"],
              ["through", "Through"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key}>
              <FieldLabel htmlFor={`period-${key}`}>{label}</FieldLabel>
              <DatePickerField
                id={`period-${key}`}
                name={`period-${key}`}
                label={label}
                value={period[key]}
                defaultDate={today}
                onChange={(date) => onChange({ ...search, [key]: date, page: 1 })}
              />
            </Field>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {planningRangeLabel(period.from, period.through)}
        </p>
      )}
    </div>
  );
}
