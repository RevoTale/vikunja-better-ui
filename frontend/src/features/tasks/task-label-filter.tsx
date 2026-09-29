import { useQuery } from "@apollo/client/react";
import { AppSelect } from "@/components/app-select";
import { TaskLabelsDocument } from "@/graphql/graphql";
import { taskLabelOptions } from "./task-label-options";

export function TaskLabelFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data, loading, error, refetch } = useQuery(TaskLabelsDocument, {
    fetchPolicy: "cache-and-network",
  });
  const labels = data?.taskLabels ?? [];
  return (
    <div className="mt-3 max-w-sm" aria-busy={loading}>
      <AppSelect
        aria-label="Filter by label"
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
