import { Field, FieldLabel } from "@/components/ui/field";
import { DatePickerField } from "./date-picker-field";
import { TimeInput24 } from "./time-input-24";

export function EditDateTimeField({
  name,
  label,
  value,
  defaultDate,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  defaultDate: string;
  onChange: (value: string) => void;
}) {
  const date = value.slice(0, 10);
  const time = value.slice(11);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`${name}-date`}>{label} date</FieldLabel>
        <DatePickerField
          id={`${name}-date`}
          name={`${name}-date`}
          label={`${label} date`}
          value={date}
          defaultDate={defaultDate}
          onChange={(next) => onChange(next ? `${next}${time ? `T${time}` : ""}` : "")}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${name}-time`}>{label} time</FieldLabel>
        <TimeInput24
          id={`${name}-time`}
          name={`${name}-time`}
          value={time}
          disabled={!date}
          onChange={(next) => onChange(`${date}${next ? `T${next}` : ""}`)}
        />
      </Field>
    </div>
  );
}
