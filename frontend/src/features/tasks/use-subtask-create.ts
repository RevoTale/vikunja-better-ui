import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { useRef, useState } from "react";
import {
  CreateSubtaskDocument,
  type CreateSubtaskMutation,
  SessionDocument,
  TaskRelationshipsDocument,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { subtaskCreationUncertain } from "./subtask-errors";
import { isTaskPriority } from "./task-priority";

export function useSubtaskCreate(parentTaskId: string) {
  const session = useQuery(SessionDocument);
  const client = useApolloClient();
  const [mutate] = useMutation(CreateSubtaskDocument);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreateSubtaskMutation["createSubtask"]>();

  async function create(form: HTMLFormElement) {
    const csrfToken = session.data?.session.csrfToken;
    if (busy.current || uncertain || !csrfToken || created?.relationError) return;
    const fields = new FormData(form);
    const priority = String(fields.get("priority"));
    if (!isTaskPriority(priority)) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await mutate({
        variables: {
          input: {
            csrfToken,
            parentTaskId,
            title: String(fields.get("title") ?? ""),
            projectId: String(fields.get("projectId")),
            priority,
            labelIds: fields.getAll("labelIds").map(String),
          },
        },
      });
      if (!result.data?.createSubtask) throw new Error("Missing confirmation");
      setCreated(result.data.createSubtask);
      const title = form.elements.namedItem("title");
      if (title instanceof HTMLInputElement) title.value = "";
      await client.refetchQueries({ include: [TaskRelationshipsDocument] }).catch(() => {
        setError("Task created. Refresh relationships to update this list.");
      });
    } catch (caught) {
      setUncertain(subtaskCreationUncertain(caught));
      setError(
        graphQLErrorMessage(
          caught,
          "Creation could not be confirmed. Check the task list before creating another task.",
        ),
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { create, pending, uncertain, error, created, setCreated, setUncertain };
}
