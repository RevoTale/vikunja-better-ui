import { DatePickerField } from "./date-picker-field";
import type { LocalDateTimeParts } from "./local-date-time";
import type { TaskFormErrors } from "./task-form-validation";
import { TimeInput24 } from "./time-input-24";
import { ValidatedField } from "./validated-field";

export function JobStartFields({
  value,
  defaultDate,
  errors,
  onChange,
}: {
  value: LocalDateTimeParts;
  defaultDate: string;
  errors: TaskFormErrors;
  onChange: (value: LocalDateTimeParts) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <ValidatedField name="startDate" label="Start date" error={errors.startDate}>
        {(attributes) => (
          <DatePickerField
            id="startDate"
            name="startDate"
            label="Start date"
            value={value.date}
            defaultDate={defaultDate}
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
