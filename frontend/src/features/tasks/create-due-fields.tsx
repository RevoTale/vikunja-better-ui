import { DatePickerField } from "./date-picker-field";
import { ReuseScheduleValue } from "./reuse-schedule-value";
import type { ChangeTaskCreationField, TaskCreationValues } from "./task-creation-values";
import type { CreationBaseType, TaskFormErrors } from "./task-form-validation";
import { TimeInput24 } from "./time-input-24";
import { ValidatedField } from "./validated-field";

export function CreateDueFields({
  type,
  errors,
  defaultDate,
  values,
  onFieldChange,
}: {
  type: CreationBaseType;
  errors: TaskFormErrors;
  defaultDate: string;
  values: TaskCreationValues;
  onFieldChange: ChangeTaskCreationField;
}) {
  const recurring = type === "recurring";
  const dateField = recurring ? "firstDueDate" : "dueDate";
  const dateLabel = recurring ? "First due date" : "Due date";
  const timeDisabled = !recurring && !values.dueDate;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <ValidatedField
        name={dateField}
        label={dateLabel}
        error={errors[dateField]}
        action={
          <ReuseScheduleValue
            field="dueDate"
            label={dateLabel.toLowerCase()}
            onApply={(date) => onFieldChange(dateField, date)}
          />
        }
      >
        {(attributes) => (
          <DatePickerField
            id={dateField}
            name={dateField}
            label={dateLabel}
            value={values[dateField]}
            defaultDate={defaultDate}
            required={recurring}
            onChange={(date) => onFieldChange(dateField, date)}
            {...attributes}
          />
        )}
      </ValidatedField>
      <ValidatedField
        name="dueTime"
        label="Due time"
        error={errors.dueTime}
        action={
          <ReuseScheduleValue
            field="dueTime"
            label="due time"
            disabled={timeDisabled}
            onApply={(time) => onFieldChange("dueTime", time)}
          />
        }
      >
        {(attributes) => (
          <TimeInput24
            id="dueTime"
            name="dueTime"
            value={values.dueTime}
            onChange={(time) => onFieldChange("dueTime", time)}
            disabled={timeDisabled}
            {...attributes}
          />
        )}
      </ValidatedField>
    </div>
  );
}
