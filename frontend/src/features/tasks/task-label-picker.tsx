import { useMutation, useQuery } from "@apollo/client/react";
import { useRef, useState } from "react";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateTaskLabelDocument, SessionDocument, TaskLabelsDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import {
  isInternalTaskLabel,
  type TaskLabel as Label,
  taskLabelOptions,
} from "./task-label-options";
import { ReuseValueButton, useTaskReuseValues } from "./task-reuse";

export function TaskLabelPicker({
  initialLabels = [],
  onPendingChange,
}: {
  initialLabels?: readonly Label[];
  onPendingChange: (pending: boolean) => void;
}) {
  const previous = useTaskReuseValues();
  const { data, loading, error, refetch } = useQuery(TaskLabelsDocument, {
    fetchPolicy: "cache-and-network",
  });
  const { data: session } = useQuery(SessionDocument);
  const [createLabel] = useMutation(CreateTaskLabelDocument);
  const [selected, setSelected] = useState(() =>
    initialLabels.filter((label) => !isInternalTaskLabel(label.title)),
  );
  const [created, setCreated] = useState<Label[]>([]);
  const [search, setSearch] = useState("");
  const [failure, setFailure] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const labels = [
    ...new Map(
      [...selected, ...created, ...(data?.taskLabels ?? [])].map((label) => [label.id, label]),
    ).values(),
  ];
  const selectedIDs = new Set(selected.map((label) => label.id));
  const options = taskLabelOptions(labels);
  const matching = options.filter(
    (option) =>
      selectedIDs.has(option.value) || option.label.toLowerCase().includes(search.toLowerCase()),
  );

  async function addLabel() {
    const csrfToken = session?.session.csrfToken;
    const title = search.trim();
    if (busy.current || !csrfToken || !title || isInternalTaskLabel(title)) return;
    busy.current = true;
    setPending(true);
    onPendingChange(true);
    setFailure("");
    try {
      const result = await createLabel({ variables: { csrfToken, title } });
      const label = result.data?.createTaskLabel;
      if (!label) throw new Error("Missing label result");
      setCreated((current) => [...current.filter((item) => item.id !== label.id), label]);
      setSelected((current) =>
        current.some((item) => item.id === label.id) ? current : [...current, label],
      );
      setSearch((current) => (current.trim() === title ? "" : current));
    } catch (caught) {
      setFailure(
        graphQLErrorMessage(
          caught,
          "The label could not be created. Retrying reuses an existing exact title.",
        ),
      );
    } finally {
      busy.current = false;
      setPending(false);
      onPendingChange(false);
    }
  }

  return (
    <fieldset className="grid min-w-0 gap-2" aria-busy={pending || loading}>
      <legend className="mb-2 text-sm font-medium">Labels</legend>
      <ReuseValueButton
        label="labels"
        value={previous?.labels.map((label) => label.title).join(", ")}
        disabled={pending || loading || Boolean(error)}
        onApply={() => {
          if (!previous || !data) return;
          const accessible = new Set(data.taskLabels.map((label) => label.id));
          setSelected((current) => [
            ...new Map(
              [
                ...current,
                ...previous.labels.filter(
                  (label) => accessible.has(label.id) && !isInternalTaskLabel(label.title),
                ),
              ].map((label) => [label.id, label]),
            ).values(),
          ]);
        }}
      />
      {selected.map((label) => (
        <input key={label.id} type="hidden" name="labelIds" value={label.id} />
      ))}
      <Input
        aria-label="Find or create label"
        placeholder="Find or create label"
        value={search}
        maxLength={250}
        onChange={(event) => setSearch(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />
      <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-2">
        {matching.map((option) => (
          <label key={option.value} className="flex min-h-10 min-w-0 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIDs.has(option.value)}
              disabled={pending}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                const label = labels.find((item) => item.id === option.value);
                if (!label) return;
                setSelected((current) =>
                  checked ? [...current, label] : current.filter((item) => item.id !== label.id),
                );
              }}
            />
            <span className="min-w-0 break-words">{option.label}</span>
          </label>
        ))}
        {loading && !data ? (
          <>
            <span className="sr-only">Loading labels</span>
            <LoadingPlaceholder className="h-10 w-full" />
          </>
        ) : null}
        {!loading && labels.length === 0 ? (
          <p className="text-sm text-muted-foreground">No labels yet.</p>
        ) : null}
      </div>
      {error ? (
        <div role="alert" className="text-sm text-destructive">
          Labels could not be loaded.{" "}
          <Button
            type="button"
            variant="ghost"
            onClick={() => void refetch().catch(() => undefined)}
          >
            Retry labels
          </Button>
        </div>
      ) : null}
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        disabled={
          pending || !session?.session.csrfToken || !search.trim() || isInternalTaskLabel(search)
        }
        onClick={addLabel}
      >
        {pending ? "Creating label…" : "Create or reuse label"}
      </Button>
      <p className="text-xs text-muted-foreground">
        New labels remain in Vikunja if you leave without saving the task. Internal labels are
        managed automatically.
      </p>
    </fieldset>
  );
}
