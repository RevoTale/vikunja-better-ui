import { AppInput } from "@/components/app-input";
import { AppSelect } from "@/components/app-select";
import { parseTime } from "@/lib/time-format";
import { useTwelveHourTime } from "@/lib/time-format-context";
import { useTimeInput } from "./use-time-input";

type TimeInput24Props = {
  id: string;
  name: string;
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
  value,
  onChange,
  disabled = false,
  required = false,
  ...attributes
}: TimeInput24Props) {
  const use12Hours = useTwelveHourTime();
  const input = useTimeInput(value, use12Hours, onChange);
  const invalid = Boolean(input.text) && parseTime(input.text, use12Hours, input.period) === null;
  return (
    <div className={use12Hours ? "grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] gap-2" : "min-w-0"}>
      <input type="hidden" name={name} value={invalid ? "invalid" : value} disabled={disabled} />
      <AppInput
        id={id}
        name={`${name}-display`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="HH:mm"
        maxLength={5}
        pattern={use12Hours ? "(0?[1-9]|1[0-2]):[0-5][0-9]" : "([01]?[0-9]|2[0-3]):[0-5][0-9]"}
        title={
          use12Hours
            ? "Enter a time from 01:00 to 12:59 and choose AM or PM."
            : "Enter a time from 00:00 to 23:59. You can also type four digits, such as 2107."
        }
        value={input.text}
        disabled={disabled}
        required={required}
        data-form-field={name}
        onChange={(event) => input.changeText(event.currentTarget.value)}
        {...attributes}
      />
      {use12Hours ? (
        <AppSelect
          aria-label={`${name} AM/PM`}
          value={input.period}
          disabled={disabled}
          options={[
            { value: "AM", label: "AM" },
            { value: "PM", label: "PM" },
          ]}
          onValueChange={input.changePeriod}
        />
      ) : null}
    </div>
  );
}
