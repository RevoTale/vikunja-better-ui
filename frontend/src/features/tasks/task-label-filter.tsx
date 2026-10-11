import { useQuery } from "@apollo/client/react";
import { TaskLabelsDocument } from "@/graphql/graphql";
import { cn } from "@/lib/utils";
import { TaskLabelCombobox } from "./task-label-combobox";
import { taskLabelOptions } from "./task-label-options";

export function TaskLabelFilter({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const { data, loading, error, refetch } = useQuery(TaskLabelsDocument, {
    fetchPolicy: "cache-and-network",
  });
  const labels = data?.taskLabels ?? [];
  const options = [
    { value: "all", label: "All labels" },
    ...(value !== "all" && !labels.some((label) => label.id === value)
      ? [{ value, label: `Label #${value}` }]
      : []),
    ...taskLabelOptions(labels),
  ];
  return (
    <div className={cn("mt-3 min-w-0 max-w-sm", className)} aria-busy={loading}>
      <TaskLabelCombobox
        options={options}
        value={value}
        loading={loading && !data}
        onChange={onChange}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Labels unavailable.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void refetch().catch(() => undefined)}
          >
            Retry labels
          </button>
        </p>
      ) : null}
    </div>
  );
}
