import { useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type AppSelectOption<Value extends string> = {
  value: Value;
  label: string;
  className?: string;
};

type AppSelectProps<Value extends string> = {
  id?: string;
  name?: string;
  value?: Value;
  defaultValue?: Value;
  options: readonly AppSelectOption<Value>[];
  onValueChange?: (value: Value) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function AppSelect<Value extends string>({
  id,
  name,
  value,
  defaultValue,
  options,
  onValueChange,
  className,
  required,
  disabled,
  ...attributes
}: AppSelectProps<Value>) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Select
      inputRef={inputRef}
      name={name}
      items={options}
      value={value}
      defaultValue={defaultValue}
      required={required}
      disabled={disabled}
      onValueChange={(nextValue) => {
        if (nextValue === null) return;
        onValueChange?.(nextValue);
        queueMicrotask(() => {
          inputRef.current?.dispatchEvent(new InputEvent("input", { bubbles: true }));
        });
      }}
    >
      <SelectTrigger
        id={id}
        className={cn("h-11! w-full rounded-md px-3 shadow-xs", className)}
        {...attributes}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className={option.className}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
