import { Select } from "@/components/ui/select";
import { isValidLocalTime } from "./local-date-time";

const hours = Array.from({ length: 24 }, (_, hour) => twoDigits(hour));
const minutes = Array.from({ length: 60 }, (_, minute) => twoDigits(minute));

type TimeInput24Props = {
  id: string;
  name: string;
  minuteLabel: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function TimeInput24({
  id,
  name,
  minuteLabel,
  value,
  onChange,
  disabled = false,
  required = false,
  ...attributes
}: TimeInput24Props) {
  const validValue = isValidLocalTime(value);
  const hour = validValue ? value.slice(0, 2) : "";
  const minute = validValue ? value.slice(3, 5) : "";

  return (
    <div className="flex items-center gap-2">
      <Select
        id={id}
        value={hour}
        disabled={disabled}
        required={required}
        data-form-field={name}
        onChange={(event) => {
          const nextHour = event.currentTarget.value;
          onChange(nextHour ? `${nextHour}:${minute || "00"}` : "");
        }}
        {...attributes}
      >
        <option value="">Hour</option>
        {hours.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      <span aria-hidden="true" className="font-medium">
        :
      </span>
      <Select
        value={minute}
        disabled={disabled || !hour}
        required={required}
        aria-label={minuteLabel}
        onChange={(event) => onChange(`${hour}:${event.currentTarget.value}`)}
        {...attributes}
      >
        <option value="">Minute</option>
        {minutes.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      <input type="hidden" name={name} value={validValue ? value : ""} disabled={disabled} />
    </div>
  );
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
