import { Input } from "@/components/ui/input";

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
  return (
    <Input
      id={id}
      name={name}
      type="time"
      step="60"
      value={value}
      disabled={disabled}
      required={required}
      data-form-field={name}
      onChange={(event) => onChange(event.currentTarget.value)}
      {...attributes}
    />
  );
}
