import { ReuseValueButton, useTaskReuseValues } from "./task-reuse";

export function ReuseScheduleValue({
  field,
  label,
  disabled = false,
  onApply,
}: {
  field: "dueDate" | "dueTime" | "startDate" | "startTime";
  label: string;
  disabled?: boolean;
  onApply: (value: string) => void;
}) {
  const previous = useTaskReuseValues();
  const value = previous?.[field];
  return (
    <ReuseValueButton
      label={label}
      value={value}
      disabled={disabled}
      onApply={() => {
        if (value) onApply(value);
      }}
    />
  );
}
