import { useState } from "react";
import { AppInput } from "./app-input";
import { AppSelect } from "./app-select";
import {
  type DurationUnit,
  durationDisplay,
  durationMinutes,
  durationUnits,
} from "./duration-value";

export function DurationInput({
  id,
  name,
  value,
  onChange,
  unitLabel = "Duration unit",
  ...attributes
}: {
  id: string;
  name: string;
  value: string;
  onChange: (minutes: string) => void;
  unitLabel?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}) {
  const [display, setDisplay] = useState(() => durationDisplay(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDisplay(durationDisplay(value));
  }
  function changeAmount(amount: string, unit: DurationUnit) {
    const next = durationMinutes(amount, unit);
    setDisplay({ amount, unit });
    setLastValue(next);
    onChange(next);
  }
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2">
      <input type="hidden" name={name} value={value} />
      <AppInput
        id={id}
        type="number"
        min="0"
        step="any"
        value={display.amount}
        onChange={(event) => changeAmount(event.currentTarget.value, display.unit)}
        {...attributes}
      />
      <AppSelect
        value={display.unit}
        aria-label={unitLabel}
        disabled={attributes.disabled ?? false}
        options={[
          { value: "minutes", label: "Minutes" },
          { value: "hours", label: "Hours" },
          { value: "days", label: "Days" },
        ]}
        onValueChange={(unit) => {
          if (value) setDisplay({ amount: String(Number(value) / durationUnits[unit]), unit });
          else setDisplay({ ...display, unit });
        }}
      />
    </div>
  );
}
