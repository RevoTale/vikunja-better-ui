import { useQuery } from "@apollo/client/react";
import { HistoryIcon } from "lucide-react";
import { createContext, type ReactNode, useContext } from "react";
import { Button } from "@/components/ui/button";
import { TaskReuseValuesDocument, type TaskReuseValuesQuery } from "@/graphql/graphql";

type ReuseValues = TaskReuseValuesQuery["taskReuseValues"];
const ReuseContext = createContext<{ values: ReuseValues | undefined } | null>(null);

export function TaskReuseProvider({
  job,
  recurring,
  children,
}: {
  job: boolean;
  recurring: boolean;
  children: ReactNode;
}) {
  const { data, loading, error, refetch } = useQuery(TaskReuseValuesDocument, {
    variables: { job, recurring },
    fetchPolicy: "no-cache",
  });
  const values = !loading && !error ? data?.taskReuseValues : undefined;
  return (
    <ReuseContext value={{ values }}>
      {children}
      {error ? (
        <div className="text-xs text-muted-foreground" role="status">
          Previous values unavailable.{" "}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void refetch().catch(() => undefined)}
          >
            Retry previous values
          </Button>
        </div>
      ) : null}
    </ReuseContext>
  );
}

export function useTaskReuseValues() {
  return useContext(ReuseContext)?.values;
}

export function ReuseValueButton({
  label,
  value,
  onApply,
  disabled = false,
}: {
  label: string;
  value: string | null | undefined;
  onApply: () => void;
  disabled?: boolean;
}) {
  const context = useContext(ReuseContext);
  if (!context) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 shrink-0"
      aria-label={`Use last ${label}`}
      title={value ? `Use last ${label}: ${value}` : `No previous ${label} available`}
      disabled={disabled || !value}
      onClick={onApply}
    >
      <HistoryIcon className="size-4" aria-hidden="true" />
    </Button>
  );
}
