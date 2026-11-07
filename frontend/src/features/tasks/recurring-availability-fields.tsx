import type { ComponentProps } from "react";
import { CreateDueFields } from "./create-due-fields";
import { defaultPlanningStart, PlanningWindowFields } from "./planning-window-fields";
import { ReuseScheduleValue } from "./reuse-schedule-value";

export function RecurringAvailabilityFields({
  values,
  defaultDate,
  errors,
  onFieldChange,
}: Omit<ComponentProps<typeof CreateDueFields>, "type" | "hideDate">) {
  const from = values.availabilitySpecific
    ? values.availableFrom
    : defaultPlanningStart(values.firstDueDate, defaultDate);
  return (
    <>
      <PlanningWindowFields
        createNow
        startTime={values.availableFromTime}
        onStartTimeChange={(time) => {
          onFieldChange("availableFromTime", time);
          if (time) {
            onFieldChange("availabilitySpecific", true);
            onFieldChange("availableFrom", from);
          }
        }}
        recurring
        today={defaultDate}
        specificStart={values.availabilitySpecific}
        value={{ from, through: values.firstDueDate }}
        error={errors.availableFrom ?? errors.firstDueDate ?? null}
        finishAction={
          <ReuseScheduleValue
            field="dueDate"
            label="first due date"
            onApply={(date) => onFieldChange("firstDueDate", date)}
          />
        }
        onChange={(next, specific) => {
          onFieldChange("firstDueDate", next.through);
          onFieldChange("availableFrom", next.from);
          onFieldChange("availabilitySpecific", Boolean(specific));
        }}
      />
      <CreateDueFields
        type="recurring"
        hideDate
        values={values}
        defaultDate={defaultDate}
        errors={errors}
        onFieldChange={onFieldChange}
      />
    </>
  );
}
