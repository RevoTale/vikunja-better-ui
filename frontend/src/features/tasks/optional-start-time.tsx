import { useId } from "react";
import { AppInput } from "@/components/app-input";
import { Button } from "@/components/ui/button";

export function OptionalStartTime({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (time: string) => void;
}) {
  const id = useId();
  return (
    <details open={Boolean(value)} className="border-t p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {value ? "Start time" : "Add time"}
      </summary>
      <label htmlFor={id} className="mt-3 grid gap-2 text-sm">
        Start time (optional)
        <AppInput
          id={id}
          type="time"
          step="60"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </label>
      {value ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
          Clear time
        </Button>
      ) : null}
    </details>
  );
}
