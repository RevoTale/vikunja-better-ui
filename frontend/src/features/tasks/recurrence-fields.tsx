import { useState } from "react";
import { AppInput } from "@/components/app-input";
import { AppSelect } from "@/components/app-select";
import type { TaskFormErrors } from "./task-form-validation";
import { ValidatedField } from "./validated-field";

export function RecurrenceFields({
  errors,
  timeOfDay,
  isJob,
  initial,
  enabled,
}: {
  errors: TaskFormErrors;
  timeOfDay: string;
  isJob: boolean;
  initial?: { interval: number; unit: string; mode: string; keepDueTime: boolean } | null;
  enabled: boolean;
}) {
  const defaults = initial ?? {
    interval: 1,
    unit: "DAY",
    mode: "FROM_COMPLETION",
    keepDueTime: true,
  };
  const [interval, setIntervalValue] = useState(String(defaults.interval));
  const [unit, setUnit] = useState(defaults.unit);
  const [mode, setMode] = useState(defaults.mode);
  const [keepDueTime, setKeepDueTime] = useState(defaults.keepDueTime);
  const canKeepDueTime = Boolean(timeOfDay) && mode === "FROM_COMPLETION" && unit !== "MONTH";
  const keepTimeLabel = isJob ? "Keep start time of day" : "Keep due time";
  const calendarMonth = unit === "MONTH";
  const rule = (
    <div className="grid gap-5 sm:grid-cols-3">
      <ValidatedField name="interval" label="Every" error={errors.interval}>
        {(attributes) => (
          <AppInput
            id="interval"
            name="interval"
            type="number"
            min="1"
            readOnly={calendarMonth}
            value={interval}
            onChange={(event) => setIntervalValue(event.currentTarget.value)}
            required
            {...attributes}
          />
        )}
      </ValidatedField>
      <ValidatedField name="unit" label="Unit" error={errors.unit}>
        {(attributes) => (
          <AppSelect
            id="unit"
            name="unit"
            value={unit}
            options={[
              { value: "DAY", label: "Days" },
              { value: "WEEK", label: "Weeks" },
              { value: "MONTH", label: "Months" },
            ]}
            onValueChange={(value) => {
              setUnit(value);
              if (value === "MONTH") {
                setIntervalValue("1");
                setMode("SCHEDULED_CYCLE");
              }
            }}
            {...attributes}
          />
        )}
      </ValidatedField>
      <ValidatedField name="mode" label="Repeat timing" error={errors.mode}>
        {(attributes) => (
          <AppSelect
            id="mode"
            name="mode"
            value={mode}
            options={[
              ...(calendarMonth ? [] : [{ value: "FROM_COMPLETION", label: "From completion" }]),
              { value: "SCHEDULED_CYCLE", label: "Fixed schedule" },
            ]}
            onValueChange={setMode}
            {...attributes}
          />
        )}
      </ValidatedField>
    </div>
  );
  return (
    <fieldset
      aria-label="Repeat schedule"
      disabled={!enabled}
      hidden={!enabled}
      className={enabled ? "grid min-w-0 gap-4" : "hidden"}
    >
      {rule}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {repeatSummary(interval, unit, mode)}
      </p>
      {canKeepDueTime ? (
        <div className="rounded-md border bg-muted/30 p-4">
          <label className="flex cursor-pointer items-start gap-3" htmlFor="keepDueTime">
            <input
              id="keepDueTime"
              name="keepDueTime"
              type="checkbox"
              checked={keepDueTime}
              onChange={(event) => setKeepDueTime(event.currentTarget.checked)}
              className="mt-1 size-4 accent-primary"
              aria-label={keepTimeLabel}
              aria-describedby="keepDueTime-description"
            />
            <span>
              <span className="block text-sm font-medium">{keepTimeLabel}</span>
              <span
                id="keepDueTime-description"
                className="mt-1 block text-sm text-muted-foreground"
              >
                Schedule from the completion date while keeping this local time. Turn it off for an
                exact elapsed interval.
              </span>
            </span>
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}

function repeatSummary(interval: string, unit: string, mode: string) {
  if (!Number.isSafeInteger(Number(interval)) || Number(interval) < 1)
    return "Choose a positive whole number.";
  const period = unit.toLowerCase();
  const duration = interval === "1" ? `1 ${period}` : `${interval} ${period}s`;
  if (mode === "FROM_COMPLETION")
    return `Set the next date ${duration} after you complete the task.`;
  return interval === "1"
    ? `Repeat every ${period} on the calendar.`
    : `Repeat every ${duration} on the calendar.`;
}
