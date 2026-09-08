import { useState } from "react";
import { DurationInput } from "@/components/duration-input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { localInstant, type ScheduleFields, shiftLocalDateTime } from "./shift-schedule";

export function EditJobDuration({
  fields,
  timezone,
  onChange,
}: {
  fields: ScheduleFields;
  timezone: string;
  onChange: (fields: ScheduleFields) => void;
}) {
  const [error, setError] = useState("");
  const duration = difference(fields.start, fields.end, timezone);
  const window = difference(fields.end, fields.due, timezone);
  const [nextDuration, setNextDuration] = useState(duration);
  const [nextWindow, setNextWindow] = useState(window);
  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Set duration and completion window
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">
        Apply duration to update End and Due in the form, then Save changes to persist them. One day
        is 24 hours.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="edit-duration">Duration</FieldLabel>
          <DurationInput
            id="edit-duration"
            name="durationMinutes"
            value={nextDuration}
            onChange={setNextDuration}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="edit-window">Completion window</FieldLabel>
          <DurationInput
            id="edit-window"
            unitLabel="Completion window unit"
            name="completionWindowMinutes"
            value={nextWindow}
            onChange={setNextWindow}
          />
        </Field>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="mt-3"
        disabled={!fields.start || !nextDuration || !nextWindow}
        onClick={() => {
          try {
            const end = shiftLocalDateTime(fields.start ?? "", Number(nextDuration), timezone);
            const due = shiftLocalDateTime(end, Number(nextWindow), timezone);
            onChange({
              ...fields,
              end,
              due,
            });
            setError("");
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Choose a valid start time.");
          }
        }}
      >
        Apply duration
      </Button>
    </details>
  );
}

function difference(start: string | undefined, end: string | undefined, timezone: string): string {
  try {
    const minutes =
      (localInstant(end ?? "", timezone) - localInstant(start ?? "", timezone)) / 60000;
    return minutes > 0 ? String(minutes) : "60";
  } catch {
    return "60";
  }
}
