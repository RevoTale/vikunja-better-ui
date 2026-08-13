import { Select } from "@/components/ui/select";
import { isValidLocalDate } from "./local-date-time";

const months = numbers(12, 1);

type DateInputDayFirstProps = {
  id: string;
  name: string;
  monthLabel: string;
  yearLabel: string;
  value: string;
  defaultDate: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function DateInputDayFirst({
  id,
  name,
  monthLabel,
  yearLabel,
  value,
  defaultDate,
  onChange,
  disabled = false,
  required = false,
  ...attributes
}: DateInputDayFirstProps) {
  const parts = dateParts(value);
  const days = numbers(daysInMonth(Number(parts.year), Number(parts.month)), 1);
  const years = yearOptions(defaultDate);

  return (
    <div className="flex items-center gap-2">
      <Select
        id={id}
        value={parts.day}
        disabled={disabled}
        required={required}
        data-form-field={name}
        onChange={(event) =>
          onChange(changeDate(parts, "day", event.currentTarget.value, defaultDate))
        }
        {...attributes}
      >
        <option value="">Day</option>
        {days.map(dateOption)}
      </Select>
      <Separator />
      <Select
        value={parts.month}
        disabled={disabled}
        required={required}
        aria-label={monthLabel}
        onChange={(event) =>
          onChange(changeDate(parts, "month", event.currentTarget.value, defaultDate))
        }
        {...attributes}
      >
        <option value="">Month</option>
        {months.map(dateOption)}
      </Select>
      <Separator />
      <Select
        value={parts.year}
        disabled={disabled}
        required={required}
        aria-label={yearLabel}
        onChange={(event) =>
          onChange(changeDate(parts, "year", event.currentTarget.value, defaultDate))
        }
        {...attributes}
      >
        <option value="">Year</option>
        {years.map(dateOption)}
      </Select>
      <input
        type="hidden"
        name={name}
        value={isValidLocalDate(value) ? value : ""}
        disabled={disabled}
      />
    </div>
  );
}

function Separator() {
  return (
    <span aria-hidden="true" className="font-medium">
      -
    </span>
  );
}

function dateOption(value: string) {
  return (
    <option key={value} value={value}>
      {value}
    </option>
  );
}

type DateParts = { day: string; month: string; year: string };

function dateParts(value: string): DateParts {
  if (!isValidLocalDate(value)) return { day: "", month: "", year: "" };
  return { year: value.slice(0, 4), month: value.slice(5, 7), day: value.slice(8, 10) };
}

function changeDate(
  parts: DateParts,
  field: keyof DateParts,
  value: string,
  defaultDate: string,
): string {
  if (!value) return "";
  const fallback = dateParts(defaultDate);
  if (!fallback.day || !fallback.month || !fallback.year) return "";
  const next = {
    day: parts.day || fallback.day,
    month: parts.month || fallback.month,
    year: parts.year || fallback.year,
    [field]: value,
  };
  const maximumDay = daysInMonth(Number(next.year), Number(next.month));
  const day = Math.min(Number(next.day), maximumDay);
  return `${next.year}-${next.month}-${twoDigits(day)}`;
}

function yearOptions(defaultDate: string): string[] {
  const year = Number(defaultDate.slice(0, 4));
  if (!isValidLocalDate(defaultDate) || year < 11) return [];
  return Array.from({ length: 61 }, (_, index) => String(year - 10 + index));
}

function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

function numbers(length: number, start: number): string[] {
  return Array.from({ length }, (_, index) => twoDigits(index + start));
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
