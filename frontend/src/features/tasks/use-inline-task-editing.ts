import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { useRef, useState } from "react";
import { SessionDocument, UpdateTaskDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import {
  type InlineTask,
  type InlineTaskField,
  type InlineTaskInput,
  inlineTaskInput,
} from "./inline-task-input";
import { useReferenceFeedback } from "./use-reference-feedback";

export function useInlineTaskEditing(task: InlineTask, refetch: () => Promise<unknown>) {
  const client = useApolloClient();
  const session = useQuery(SessionDocument);
  const feedback = useReferenceFeedback();
  const [update] = useMutation(UpdateTaskDocument);
  const lock = useRef(false);
  const [active, setActive] = useState<InlineTaskField | null>(null);
  const [input, setInput] = useState(() => inlineTaskInput(task));
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function open(field: InlineTaskField) {
    if (lock.current || blocked || task.isDone || (active && active !== field)) return;
    setInput(inlineTaskInput(task));
    setError("");
    setNotice("");
    setActive(field);
  }
  function cancel() {
    if (!lock.current) setActive(null);
  }
  async function save(next: InlineTaskInput = input) {
    if (lock.current || blocked || task.isDone) return;
    const csrfToken = session.data?.session.csrfToken;
    if (!csrfToken) {
      setError("Your session is unavailable. Refresh and sign in again.");
      return;
    }
    lock.current = true;
    setPending(true);
    setError("");
    let confirmed = false;
    try {
      const result = await update({ variables: { input: { ...next, csrfToken } } });
      if (!result.data?.updateTask) throw new Error("Update was not confirmed.");
      confirmed = true;
      feedback(result.data.updateTask.referenceLinking, csrfToken);
      for (const fieldName of ["tasks", "week"]) client.cache.evict({ fieldName });
      await refetch();
      setActive(null);
      setNotice("Changes saved.");
    } catch (caught) {
      setBlocked(!isValidationFailure(caught));
      setError(inlineSaveMessage(caught, confirmed));
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    try {
      await refetch();
      setActive(null);
      setBlocked(false);
      setError("");
    } catch (caught) {
      setError(graphQLErrorMessage(caught, "The task could not be reloaded."));
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  async function runAction(action: () => Promise<void>) {
    if (lock.current || active || blocked) return;
    lock.current = true;
    setPending(true);
    try {
      await action();
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return {
    active,
    input,
    setInput,
    pending,
    blocked,
    error,
    notice,
    open,
    cancel,
    save,
    reload,
    runAction,
  };
}

export type InlineTaskEditing = ReturnType<typeof useInlineTaskEditing>;

function isValidationFailure(error: unknown): boolean {
  return (
    CombinedGraphQLErrors.is(error) &&
    error.errors.length > 0 &&
    error.errors.every((failure) => failure.extensions?.["code"] === "VALIDATION_FAILED")
  );
}

function inlineSaveMessage(error: unknown, confirmed: boolean): string {
  if (confirmed)
    return "Changes were saved, but fresh task data could not be loaded. Reload the task before editing again.";
  return graphQLErrorMessage(
    error,
    "The update could not be confirmed. Reload the task before retrying.",
  );
}
