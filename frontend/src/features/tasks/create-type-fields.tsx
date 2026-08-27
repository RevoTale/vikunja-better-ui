import { useState } from "react";

import { AppInput } from "@/components/app-input";
import { AppSelect } from "@/components/app-select";
import type {
  ChangeTaskCreationAutofillField,
  TaskCreationAutofillField,
  TaskCreationValues,
} from "./autofill/task-creation-autofill";
import { DatePickerField } from "./date-picker-field";
import { JobStartFields } from "./job-start-fields";
import type { LocalDateTimeParts } from "./local-date-time";
import type { CreationBaseType, TaskFormErrors } from "./task-form-validation";
import { TimeInput24 } from "./time-input-24";
import { ValidatedField } from "./validated-field";

export function TaskTypeFields({
  type,
  errors,
  defaultDate,
  values,
  autofilled,
  onFieldChange,
}: {
  type: CreationBaseType;
  errors: TaskFormErrors;
  defaultDate: string;
  values: TaskCreationValues;
  autofilled: ReadonlySet<TaskCreationAutofillField>;
  onFieldChange: ChangeTaskCreationAutofillField;
}) {
  if (values.job)
    return (
      <>
        <JobFields
          errors={errors}
          defaultDate={defaultDate}
          start={{ date: values.startDate, time: values.startTime }}
          values={values}
          autofilled={autofilled}
          onFieldChange={onFieldChange}
        />
        {type === "recurring" ? (
          <RecurrenceFields errors={errors} timeOfDay={values.startTime} isJob />
        ) : null}
      </>
    );
  if (type === "one-time")
    return (
      <OneTimeFields
        errors={errors}
        defaultDate={defaultDate}
        values={values}
        autofilled={autofilled}
        onFieldChange={onFieldChange}
      />
    );
  if (type === "recurring")
    return (
      <RecurringFields
        errors={errors}
        defaultDate={defaultDate}
        values={values}
        autofilled={autofilled}
        onFieldChange={onFieldChange}
      />
    );
  return null;
}

function OneTimeFields({
  errors,
  defaultDate,
  values,
  autofilled,
  onFieldChange,
}: {
  errors: TaskFormErrors;
  defaultDate: string;
  values: TaskCreationValues;
  autofilled: ReadonlySet<TaskCreationAutofillField>;
  onFieldChange: ChangeTaskCreationAutofillField;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <ValidatedField
        name="dueDate"
        label="Due date"
        error={errors.dueDate}
        autofilled={autofilled.has("dueDate")}
      >
        {(attributes) => (
          <DatePickerField
            id="dueDate"
            name="dueDate"
            label="Due date"
            value={values.dueDate}
            defaultDate={defaultDate}
            onChange={(dueDate) => onFieldChange("dueDate", dueDate)}
            {...attributes}
          />
        )}
      </ValidatedField>
      <ValidatedField
        name="dueTime"
        label="Due time"
        error={errors.dueTime}
        autofilled={autofilled.has("dueTime")}
      >
        {(attributes) => (
          <TimeInput24
            id="dueTime"
            name="dueTime"
            value={values.dueTime}
            onChange={(dueTime) => onFieldChange("dueTime", dueTime)}
            disabled={!values.dueDate}
            {...attributes}
          />
        )}
      </ValidatedField>
    </div>
  );
}

function RecurringFields({
  errors,
  defaultDate,
  values,
  autofilled,
  onFieldChange,
}: {
  errors: TaskFormErrors;
  defaultDate: string;
  values: TaskCreationValues;
  autofilled: ReadonlySet<TaskCreationAutofillField>;
  onFieldChange: ChangeTaskCreationAutofillField;
}) {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <ValidatedField
          name="firstDueDate"
          label="First due date"
          error={errors.firstDueDate}
          autofilled={autofilled.has("firstDueDate")}
        >
          {(attributes) => (
            <DatePickerField
              id="firstDueDate"
              name="firstDueDate"
              label="First due date"
              value={values.firstDueDate}
              defaultDate={defaultDate}
              onChange={(firstDueDate) => onFieldChange("firstDueDate", firstDueDate)}
              required
              {...attributes}
            />
          )}
        </ValidatedField>
        <ValidatedField
          name="dueTime"
          label="Due time"
          error={errors.dueTime}
          autofilled={autofilled.has("dueTime")}
        >
          {(attributes) => (
            <TimeInput24
              id="dueTime"
              name="dueTime"
              value={values.dueTime}
              onChange={(dueTime) => onFieldChange("dueTime", dueTime)}
              {...attributes}
            />
          )}
        </ValidatedField>
      </div>
      <RecurrenceFields errors={errors} timeOfDay={values.dueTime} isJob={false} />
    </>
  );
}

function RecurrenceFields({
  errors,
  timeOfDay,
  isJob,
}: {
  errors: TaskFormErrors;
  timeOfDay: string;
  isJob: boolean;
}) {
  const [unit, setUnit] = useState("DAY");
  const [mode, setMode] = useState("FROM_COMPLETION");
  const [keepDueTime, setKeepDueTime] = useState(true);
  const canKeepDueTime = Boolean(timeOfDay) && mode === "FROM_COMPLETION" && unit !== "MONTH";
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-3">
        <ValidatedField name="interval" label="Every" error={errors.interval}>
          {(attributes) => (
            <AppInput
              id="interval"
              name="interval"
              type="number"
              min="1"
              defaultValue="1"
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
              onValueChange={setUnit}
              {...attributes}
            />
          )}
        </ValidatedField>
        <ValidatedField name="mode" label="Renewal" error={errors.mode}>
          {(attributes) => (
            <AppSelect
              id="mode"
              name="mode"
              value={mode}
              options={[
                { value: "FROM_COMPLETION", label: "From completion" },
                { value: "SCHEDULED_CYCLE", label: "Scheduled cycle" },
              ]}
              onValueChange={setMode}
              {...attributes}
            />
          )}
        </ValidatedField>
      </div>
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
              aria-label={isJob ? "Keep start time of day" : "Keep due time"}
              aria-describedby="keepDueTime-description"
            />
            <span>
              <span className="block text-sm font-medium">
                {isJob ? "Keep start time of day" : "Keep due time"}
              </span>
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
    </>
  );
}

function JobFields({
  errors,
  defaultDate,
  start,
  values,
  autofilled,
  onFieldChange,
}: {
  errors: TaskFormErrors;
  defaultDate: string;
  start: LocalDateTimeParts;
  values: TaskCreationValues;
  autofilled: ReadonlySet<TaskCreationAutofillField>;
  onFieldChange: ChangeTaskCreationAutofillField;
}) {
  return (
    <>
      <JobStartFields
        value={start}
        defaultDate={defaultDate}
        errors={errors}
        autofilled={autofilled}
        onChange={(next) => {
          if (next.date !== start.date) onFieldChange("startDate", next.date);
          if (next.time !== start.time) onFieldChange("startTime", next.time);
        }}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <ValidatedField
          name="durationMinutes"
          label="Duration in minutes"
          error={errors.durationMinutes}
          autofilled={autofilled.has("durationMinutes")}
        >
          {(attributes) => (
            <AppInput
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              min="1"
              value={values.durationMinutes}
              onChange={(event) => onFieldChange("durationMinutes", event.currentTarget.value)}
              required
              {...attributes}
            />
          )}
        </ValidatedField>
        <ValidatedField
          name="completionWindowMinutes"
          label="Time to complete after it ends"
          error={errors.completionWindowMinutes}
          autofilled={autofilled.has("completionWindowMinutes")}
        >
          {(attributes) => (
            <AppInput
              id="completionWindowMinutes"
              name="completionWindowMinutes"
              type="number"
              min="1"
              value={values.completionWindowMinutes}
              onChange={(event) =>
                onFieldChange("completionWindowMinutes", event.currentTarget.value)
              }
              required
              {...attributes}
            />
          )}
        </ValidatedField>
      </div>
    </>
  );
}
