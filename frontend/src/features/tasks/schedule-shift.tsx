import { useState } from "react";
import { AppSelect } from "@/components/app-select";
import { DurationInput } from "@/components/duration-input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { type ScheduleFields, type ScheduleTarget, shiftSchedule } from "./shift-schedule";

const labels = { start: "Start", end: "End", due: "Due" };

export function ScheduleShift({
  fields,
  timezone,
  onChange,
}: {
  fields: ScheduleFields;
  timezone: string;
  onChange: (fields: ScheduleFields) => void;
}) {
  const [minutes, setMinutes] = useState("60");
  const [applied, setApplied] = useState(false);
  const [direction, setDirection] = useState<"later" | "earlier">("later");
  const [target, setTarget] = useState<ScheduleTarget>("all");
  const available = (["start", "end", "due"] as const).filter((field) => Boolean(fields[field]));
  const effectiveTarget = target === "all" || available.includes(target) ? target : "all";
  let preview: ScheduleFields | undefined;
  let error = "";
  try {
    if (available.length > 0 && minutes)
      preview = shiftSchedule(
        fields,
        effectiveTarget,
        Number(minutes) * (direction === "later" ? 1 : -1),
        timezone,
      );
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "The schedule cannot be shifted.";
  }
  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">Shift schedule</summary>
      <div className="mt-3 grid gap-3">
        <p className="text-sm text-muted-foreground">
          Preview only — apply to update the date fields.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <AppSelect
            aria-label="Shift target"
            value={effectiveTarget}
            onValueChange={setTarget}
            options={[
              { value: "all", label: "Whole schedule" },
              ...available.map((value) => ({ value, label: labels[value] })),
            ]}
          />
          <AppSelect
            aria-label="Shift direction"
            value={direction}
            onValueChange={setDirection}
            options={[
              { value: "later", label: "Later (+)" },
              { value: "earlier", label: "Earlier (−)" },
            ]}
          />
        </div>
        <Field>
          <FieldLabel htmlFor="shift-duration">Shift by</FieldLabel>
          <DurationInput
            id="shift-duration"
            unitLabel="Shift unit"
            name="shiftMinutes"
            value={minutes}
            onChange={(value) => {
              setMinutes(value);
              setApplied(false);
            }}
          />
        </Field>
        <div className="text-sm text-muted-foreground" aria-live="polite">
          {preview ? (
            available
              .filter((field) => effectiveTarget === "all" || effectiveTarget === field)
              .map((field) => (
                <p key={field}>
                  {labels[field]}: {fields[field]?.replace("T", " ")} →{" "}
                  {preview?.[field]?.replace("T", " ")}
                </p>
              ))
          ) : (
            <p>
              {error ||
                (applied
                  ? "Shift applied to date fields."
                  : "Set a date and a duration to preview the shift.")}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!preview}
          onClick={() => {
            if (preview) {
              onChange(preview);
              setMinutes("");
              setApplied(true);
            }
          }}
        >
          Apply shift to fields
        </Button>
      </div>
    </details>
  );
}
