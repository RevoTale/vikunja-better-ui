import { useState } from "react";

import { AppInput } from "@/components/app-input";
import { AppSelect } from "@/components/app-select";
import { DatePickerField } from "./date-picker-field";
import { JobStartFields } from "./job-start-fields";
import type { LocalDateTimeParts } from "./local-date-time";
import type { CreationType, TaskFormErrors } from "./task-form-validation";
import { TimeInput24 } from "./time-input-24";
import { ValidatedField } from "./validated-field";

export function TaskTypeFields({
  type,
  errors,
  defaultDate,
  initialDate,
  jobStart,
  onJobStartChange,
}: {
  type: CreationType;
  errors: TaskFormErrors;
  defaultDate: string;
  initialDate: string | undefined;
  jobStart: LocalDateTimeParts;
  onJobStartChange: (value: LocalDateTimeParts) => void;
}) {
  if (type === "one-time")
    return <OneTimeFields errors={errors} defaultDate={defaultDate} initialDate={initialDate} />;
  if (type === "recurring")
    return <RecurringFields errors={errors} defaultDate={initialDate ?? defaultDate} />;
  return (
    <JobFields
      errors={errors}
      defaultDate={defaultDate}
      start={jobStart}
      onStartChange={onJobStartChange}
    />
  );
}

function OneTimeFields({
  errors,
  defaultDate,
  initialDate,
}: {
  errors: TaskFormErrors;
  defaultDate: string;
  initialDate: string | undefined;
}) {
  const [dueDate, setDueDate] = useState(initialDate ?? "");
  const [dueTime, setDueTime] = useState("");
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <ValidatedField name="dueDate" label="Due date" error={errors.dueDate}>
        {(attributes) => (
          <DatePickerField
            id="dueDate"
            name="dueDate"
            label="Due date"
            value={dueDate}
            defaultDate={defaultDate}
            onChange={setDueDate}
            {...attributes}
          />
        )}
      </ValidatedField>
      <ValidatedField name="dueTime" label="Due time" error={errors.dueTime}>
        {(attributes) => (
          <TimeInput24
            id="dueTime"
            name="dueTime"
            value={dueTime}
            onChange={setDueTime}
            disabled={!dueDate}
            {...attributes}
          />
        )}
      </ValidatedField>
    </div>
  );
}

function RecurringFields({ errors, defaultDate }: { errors: TaskFormErrors; defaultDate: string }) {
  const [firstDueDate, setFirstDueDate] = useState(defaultDate);
  const [dueTime, setDueTime] = useState("");
  const [unit, setUnit] = useState("DAY");
  const [mode, setMode] = useState("FROM_COMPLETION");
  const [keepDueTime, setKeepDueTime] = useState(true);
  const canKeepDueTime = Boolean(dueTime) && mode === "FROM_COMPLETION" && unit !== "MONTH";
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <ValidatedField name="firstDueDate" label="First due date" error={errors.firstDueDate}>
          {(attributes) => (
            <DatePickerField
              id="firstDueDate"
              name="firstDueDate"
              label="First due date"
              value={firstDueDate}
              defaultDate={defaultDate}
              onChange={setFirstDueDate}
              required
              {...attributes}
            />
          )}
        </ValidatedField>
        <ValidatedField name="dueTime" label="Due time" error={errors.dueTime}>
          {(attributes) => (
            <TimeInput24
              id="dueTime"
              name="dueTime"
              value={dueTime}
              onChange={setDueTime}
              {...attributes}
            />
          )}
        </ValidatedField>
      </div>
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
              aria-describedby="keepDueTime-description"
            />
            <span>
              <span className="block text-sm font-medium">Keep due time</span>
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
  onStartChange,
}: {
  errors: TaskFormErrors;
  defaultDate: string;
  start: LocalDateTimeParts;
  onStartChange: (value: LocalDateTimeParts) => void;
}) {
  return (
    <>
      <JobStartFields
        value={start}
        defaultDate={defaultDate}
        errors={errors}
        onChange={onStartChange}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <ValidatedField
          name="durationMinutes"
          label="Duration in minutes"
          error={errors.durationMinutes}
        >
          {(attributes) => (
            <AppInput
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              min="1"
              defaultValue="60"
              required
              {...attributes}
            />
          )}
        </ValidatedField>
        <ValidatedField
          name="completionWindowMinutes"
          label="Time to complete after it ends"
          error={errors.completionWindowMinutes}
        >
          {(attributes) => (
            <AppInput
              id="completionWindowMinutes"
              name="completionWindowMinutes"
              type="number"
              min="1"
              defaultValue="60"
              required
              {...attributes}
            />
          )}
        </ValidatedField>
      </div>
    </>
  );
}
