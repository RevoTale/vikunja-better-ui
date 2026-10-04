import { useQuery } from "@apollo/client/react";
import { AppSelect } from "@/components/app-select";
import { TaskLabelsDocument } from "@/graphql/graphql";
import { cn } from "@/lib/utils";
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
  return (
    <div className={cn("mt-3 min-w-0 max-w-sm", className)} aria-busy={loading}>
      <AppSelect
        aria-label="Filter by label"
        className="sm:h-9!"
        value={value}
        options={[
          { value: "all", label: "All labels" },
          ...(value !== "all" && !labels.some((label) => label.id === value)
            ? [{ value, label: `Label #${value}` }]
            : []),
          ...taskLabelOptions(labels),
        ]}
        onValueChange={onChange}
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
