import { useMutation, useQuery } from "@apollo/client/react";
import { useRef, useState } from "react";
import { CreateTaskLabelDocument, SessionDocument, TaskLabelsDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import {
  isInternalTaskLabel,
  type TaskLabel as Label,
  taskLabelOptions,
} from "./task-label-options";

export function useTaskLabelPicker(
  initialLabels: readonly Label[],
  onPendingChange: (pending: boolean) => void,
) {
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

  return {
    data,
    loading,
    error,
    refetch,
    session,
    selected,
    setSelected,
    search,
    setSearch,
    pending,
    labels,
    selectedIDs,
    matching,
    failure,
    addLabel,
  };
}
