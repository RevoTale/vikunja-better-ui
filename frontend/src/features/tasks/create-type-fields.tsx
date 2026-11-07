import { DurationInput } from "@/components/duration-input";
import { CreateDueFields } from "./create-due-fields";
import { JobStartFields } from "./job-start-fields";
import type { LocalDateTimeParts } from "./local-date-time";
import { defaultPlanningStart, PlanningWindowFields } from "./planning-window-fields";
import { RecurrenceFields } from "./recurrence-fields";
import { RecurringAvailabilityFields } from "./recurring-availability-fields";
import type { ChangeTaskCreationField, TaskCreationValues } from "./task-creation-values";
import type { CreationBaseType, TaskFormErrors } from "./task-form-validation";
import { ReuseValueButton, useTaskReuseValues } from "./task-reuse";
import { TimeInput24 } from "./time-input-24";
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
  const recurring = type === "recurring";
  const planningStart = values.planningSpecific
    ? values.planningStartsOn
    : defaultPlanningStart(values.planningEndsOn, defaultDate);
  const deadline = (
    <CreateDueFields
      type={type}
      errors={errors}
      defaultDate={defaultDate}
      values={values}
      onFieldChange={onFieldChange}
    />
  );
  return (
    <>
      {values.job ? (
        <JobFields
          errors={errors}
          defaultDate={defaultDate}
          start={{ date: values.startDate, time: values.startTime }}
          values={values}
          onFieldChange={onFieldChange}
        />
      ) : !recurring ? (
        <PlanningWindowFields
          createNow
          startTime={values.planningStartTime}
          onStartTimeChange={(time) => {
            onFieldChange("planningStartTime", time);
            if (time) {
              onFieldChange("planningSpecific", true);
              onFieldChange("planningStartsOn", planningStart);
            }
          }}
          finishTimeField={
            <FinishTimeField values={values} errors={errors} onFieldChange={onFieldChange} />
          }
          today={defaultDate}
          deadline={values.dueDate}
          specificStart={values.planningSpecific}
          value={{
            from: planningStart,
            through: values.planningEndsOn,
          }}
          onChange={({ from, through }, specific) => {
            onFieldChange("planningStartsOn", from);
            onFieldChange("planningEndsOn", through);
            if (!through) onFieldChange("planningFinishTime", "");
            onFieldChange("planningSpecific", Boolean(specific));
          }}
        />
      ) : null}
      <RecurrenceFields
        errors={errors}
        timeOfDay={values.job ? values.startTime : values.dueTime}
        isJob={values.job}
        enabled={recurring}
      />
      {!values.job &&
        (recurring ? (
          <RecurringAvailabilityFields
            values={values}
            defaultDate={defaultDate}
            errors={errors}
            onFieldChange={onFieldChange}
          />
        ) : (
          <div className="grid gap-2">
            {deadline}
            <p className="text-sm text-muted-foreground">
              Need it done by 12:00? Set a deadline date and time. It becomes overdue after that; no
              duration is needed.
            </p>
          </div>
        ))}
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
          label="Extra time to finish"
          error={errors.completionWindowMinutes}
          action={
            <ReuseValueButton
              label="extra time to finish"
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
              unitLabel="Extra time unit"
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

function FinishTimeField({
  values,
  errors,
  onFieldChange,
}: {
  values: TaskCreationValues;
  errors: TaskFormErrors;
  onFieldChange: ChangeTaskCreationField;
}) {
  if (!values.planningEndsOn) return null;
  return (
    <ValidatedField
      name="planningFinishTime"
      label="Planned finish time"
      error={errors.planningFinishTime}
    >
      {(attributes) => (
        <TimeInput24
          id="planningFinishTime"
          name="planningFinishTime"
          value={values.planningFinishTime}
          onChange={(time) => onFieldChange("planningFinishTime", time)}
          {...attributes}
        />
      )}
    </ValidatedField>
  );
}
