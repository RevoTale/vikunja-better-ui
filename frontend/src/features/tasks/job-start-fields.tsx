import { DateInputDayFirst } from "./date-input-day-first";
import type { LocalDateTimeParts } from "./local-date-time";
import type { TaskFormErrors } from "./task-form-validation";
import { TimeInput24 } from "./time-input-24";
import { ValidatedField } from "./validated-field";

export function JobStartFields({
  value,
  errors,
  onChange,
}: {
  value: LocalDateTimeParts;
  errors: TaskFormErrors;
  onChange: (value: LocalDateTimeParts) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <ValidatedField name="startDate" label="Start date" error={errors.startDate}>
        {(attributes) => (
          <DateInputDayFirst
            id="startDate"
            name="startDate"
            monthLabel="Start date month"
            yearLabel="Start date year"
            value={value.date}
            onChange={(date) => onChange({ ...value, date })}
            required
            {...attributes}
          />
        )}
      </ValidatedField>
      <ValidatedField name="startTime" label="Start time" error={errors.startTime}>
        {(attributes) => (
          <TimeInput24
            id="startTime"
            name="startTime"
            minuteLabel="Start time minute"
            value={value.time}
            onChange={(time) => onChange({ ...value, time })}
            required
            {...attributes}
          />
        )}
      </ValidatedField>
    </div>
  );
}
