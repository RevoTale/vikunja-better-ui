import { useState } from "react";

import { AppInput } from "@/components/app-input";
import { AppSelect } from "@/components/app-select";
import { DurationInput } from "@/components/duration-input";
import { CreateDueFields } from "./create-due-fields";
import { JobStartFields } from "./job-start-fields";
import type { LocalDateTimeParts } from "./local-date-time";
import type { ChangeTaskCreationField, TaskCreationValues } from "./task-creation-values";
import type { CreationBaseType, TaskFormErrors } from "./task-form-validation";
import { ReuseValueButton, useTaskReuseValues } from "./task-reuse";
import { ValidatedField } from "./validated-field";

export function TaskTypeFields({
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
  if (values.job)
    return (
      <>
        <JobFields
          errors={errors}
          defaultDate={defaultDate}
          start={{ date: values.startDate, time: values.startTime }}
          values={values}
          onFieldChange={onFieldChange}
        />
        {type === "recurring" ? (
          <RecurrenceFields errors={errors} timeOfDay={values.startTime} isJob />
        ) : null}
      </>
    );
  return (
    <>
      <CreateDueFields
        type={type}
        errors={errors}
        defaultDate={defaultDate}
        values={values}
        onFieldChange={onFieldChange}
      />
      {type === "recurring" ? (
        <RecurrenceFields errors={errors} timeOfDay={values.dueTime} isJob={false} />
      ) : null}
    </>
  );
}

export function RecurrenceFields({
  errors,
  timeOfDay,
  isJob,
  initial,
}: {
  errors: TaskFormErrors;
  timeOfDay: string;
  isJob: boolean;
  initial?: { interval: number; unit: string; mode: string; keepDueTime: boolean } | null;
}) {
  const [unit, setUnit] = useState(initial?.unit ?? "DAY");
  const [mode, setMode] = useState(initial?.mode ?? "FROM_COMPLETION");
  const [keepDueTime, setKeepDueTime] = useState(initial?.keepDueTime ?? true);
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
              defaultValue={initial?.interval ?? 1}
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
  onFieldChange,
}: {
  errors: TaskFormErrors;
  defaultDate: string;
  start: LocalDateTimeParts;
  values: TaskCreationValues;
  onFieldChange: ChangeTaskCreationField;
}) {
  const previous = useTaskReuseValues();
  return (
    <>
      <JobStartFields
        value={start}
        defaultDate={defaultDate}
        errors={errors}
        onChange={(next) => {
          if (next.date !== start.date) onFieldChange("startDate", next.date);
          if (next.time !== start.time) onFieldChange("startTime", next.time);
        }}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <ValidatedField
          name="durationMinutes"
          label="Duration"
          error={errors.durationMinutes}
          action={
            <ReuseValueButton
              label="duration"
              value={previous?.durationMinutes ? `${previous.durationMinutes} min` : null}
              onApply={() => {
                if (previous?.durationMinutes)
                  onFieldChange("durationMinutes", String(previous.durationMinutes));
              }}
            />
          }
        >
          {(attributes) => (
            <DurationInput
              id="durationMinutes"
              name="durationMinutes"
              value={values.durationMinutes}
              onChange={(value) => onFieldChange("durationMinutes", value)}
              required
              {...attributes}
            />
          )}
        </ValidatedField>
        <ValidatedField
          name="completionWindowMinutes"
          label="Time to complete after it ends"
          error={errors.completionWindowMinutes}
          action={
            <ReuseValueButton
              label="completion window"
              value={
                previous?.completionWindowMinutes ? `${previous.completionWindowMinutes} min` : null
              }
              onApply={() => {
                if (previous?.completionWindowMinutes)
                  onFieldChange(
                    "completionWindowMinutes",
                    String(previous.completionWindowMinutes),
                  );
              }}
            />
          }
        >
          {(attributes) => (
            <DurationInput
              id="completionWindowMinutes"
              unitLabel="Completion window unit"
              name="completionWindowMinutes"
              value={values.completionWindowMinutes}
              onChange={(value) => onFieldChange("completionWindowMinutes", value)}
              required
              {...attributes}
            />
          )}
        </ValidatedField>
      </div>
    </>
  );
}
