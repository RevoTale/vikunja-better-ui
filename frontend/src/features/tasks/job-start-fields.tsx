import { Input } from "@/components/ui/input";
import type { LocalDateTimeParts } from "./local-date-time";
import type { TaskFormErrors } from "./task-form-validation";
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
          <Input
            id="startDate"
            name="startDate"
            type="date"
            value={value.date}
            onChange={(event) => onChange({ ...value, date: event.currentTarget.value })}
            required
            {...attributes}
          />
        )}
      </ValidatedField>
      <ValidatedField name="startTime" label="Start time" error={errors.startTime}>
        {(attributes) => (
          <Input
            id="startTime"
            name="startTime"
            type="time"
            value={value.time}
            onChange={(event) => onChange({ ...value, time: event.currentTarget.value })}
            required
            {...attributes}
          />
        )}
      </ValidatedField>
    </div>
  );
}
