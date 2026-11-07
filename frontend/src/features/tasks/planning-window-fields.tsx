import { type ReactNode, useState } from "react";
import { DatePickerField } from "./date-picker-field";
import { OptionalStartTime } from "./optional-start-time";
import { type PlanningPeriod, planningDateLabel, planningWindowError } from "./planning-dates";
import { ValidatedField } from "./validated-field";

export function defaultPlanningStart(finish: string, today: string) {
  if (!finish) return "";
  return finish < today ? finish : today;
}

export function PlanningWindowFields({
  value,
  today,
  deadline = "",
  timedStart = false,
  recurring = false,
  specificStart,
  startTime = "",
  onStartTimeChange,
  finishAction,
  finishTimeField,
  createNow = false,
  error = planningWindowError(value.from, value.through, deadline),
  onChange,
}: {
  value: PlanningPeriod;
  today: string;
  deadline?: string;
  timedStart?: boolean;
  recurring?: boolean;
  specificStart?: boolean;
  startTime?: string;
  onStartTimeChange?: (time: string) => void;
  finishAction?: ReactNode;
  finishTimeField?: ReactNode;
  createNow?: boolean;
  error?: string | null;
  onChange: (next: PlanningPeriod, specific?: boolean) => void;
}) {
  const [pickingDate, setPickingDate] = useState(false);
  const automatic = defaultPlanningStart(value.through, today);
  const custom =
    specificStart ??
    (pickingDate || Boolean(value.from && (timedStart || value.from !== automatic)));
  const finishName = recurring ? "firstDueDate" : "planningEndsOn";
  const finishLabel = recurring ? "First due date" : "Planned finish";
  const startName = recurring ? "availableFrom" : "planningStartsOn";
  // Some imported tasks have only a finish. Opening them must preserve the missing start.
  function setFinish(through: string) {
    if (through === value.through) return;
    if (!through) setPickingDate(false);
    if (!through) onStartTimeChange?.("");
    const from = custom && value.from ? value.from : defaultPlanningStart(through, today);
    onChange({ from: through ? from : "", through }, custom);
  }
  function setAutomatic() {
    onStartTimeChange?.("");
    setPickingDate(false);
    if (custom || value.from !== automatic || timedStart)
      onChange({ ...value, from: automatic }, false);
  }
  return (
    <div className="grid min-w-0 gap-3">
      <ValidatedField
        name={finishName}
        label={finishLabel}
        error={error ?? undefined}
        action={finishAction}
      >
        {(attributes) => (
          <DatePickerField
            id={finishName}
            name={finishName}
            label={finishLabel}
            value={value.through}
            defaultDate={value.from || today}
            required={recurring}
            onChange={setFinish}
            {...attributes}
          />
        )}
      </ValidatedField>
      {finishTimeField}
      {onStartTimeChange ? (
        <input
          type="hidden"
          name={recurring ? "availableFromTime" : "planningStartTime"}
          value={startTime}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 text-sm">
        <AvailabilitySummary
          value={value}
          today={today}
          createNow={createNow}
          custom={custom}
          startTime={startTime}
        />
        <DatePickerField
          id={startName}
          name={startName}
          label="Available from"
          triggerText="Change availability"
          resetLabel="Use automatic start"
          calendarFooter={
            onStartTimeChange ? (
              <OptionalStartTime
                value={startTime}
                disabled={!value.from}
                onChange={onStartTimeChange}
              />
            ) : undefined
          }
          value={value.from}
          defaultDate={value.from || today}
          onChange={(from) => {
            if (!from) setAutomatic();
            else {
              setPickingDate(true);
              onChange({ ...value, from }, true);
            }
          }}
        />
      </div>
      {timedStart ? (
        <p className="text-sm text-muted-foreground">
          This task has exact times. Changing its planning dates here sets a whole-day window.
        </p>
      ) : null}
    </div>
  );
}

function availabilityLabel({ from, through }: PlanningPeriod, today: string) {
  if (!from && through) return "No start date set";
  return !from || from === today
    ? "Available from today"
    : `Available from ${planningDateLabel(from)}`;
}

function AvailabilitySummary({
  value,
  today,
  createNow,
  custom,
  startTime,
}: {
  value: PlanningPeriod;
  today: string;
  createNow: boolean;
  custom: boolean;
  startTime: string;
}) {
  const startsNow = createNow && !custom && Boolean(value.through) && value.from === today;
  return (
    <>
      {createNow ? <input type="hidden" name="startNow" value={String(startsNow)} /> : null}
      <span aria-live="polite">
        {startsNow ? "Available now" : availabilityLabel(value, today)}
        {startTime ? `, ${startTime}` : ""}
      </span>
    </>
  );
}
