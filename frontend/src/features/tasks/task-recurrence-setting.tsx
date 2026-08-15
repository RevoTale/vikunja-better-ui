import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { useState } from "react";

import {
  SessionDocument,
  SetRecurringKeepDueTimeDocument,
  type TaskDetailsQuery,
  TaskListDocument,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { recurrenceSettingPolicy } from "./recurrence-setting-policy";

type TaskDetail = NonNullable<TaskDetailsQuery["task"]>;

export function TaskRecurrenceSetting({
  task,
  onChanged,
}: {
  task: TaskDetail;
  onChanged: () => Promise<unknown>;
}) {
  const client = useApolloClient();
  const { data: sessionData, error: sessionError } = useQuery(SessionDocument);
  const [save] = useMutation(SetRecurringKeepDueTimeDocument);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const policy = recurrenceSettingPolicy(task);
  const checked = task.recurrenceRule?.keepDueTime ?? false;

  if (!policy.visible) return null;

  async function changeSetting(enabled: boolean) {
    if (enabled && !policy.canEnable) return;
    setError("");
    setNotice("");
    const csrfToken = sessionData?.session.csrfToken;
    if (!csrfToken) {
      setError(
        graphQLErrorMessage(
          sessionError,
          "Refresh the page and sign in again before changing this setting.",
        ),
      );
      return;
    }
    setPending(true);
    try {
      const payload = (
        await save({ variables: { input: { csrfToken, taskId: task.id, enabled } } })
      ).data?.setRecurringKeepDueTime;
      if (payload?.status !== "CONFIRMED") {
        throw new Error("setting was not confirmed");
      }
      setNotice(
        enabled
          ? "Future occurrences will keep this local due time."
          : "Future occurrences will use the exact elapsed interval.",
      );
      await onChanged();
      await client.refetchQueries({ include: [TaskListDocument] });
    } catch (caught) {
      setError(
        graphQLErrorMessage(
          caught,
          "The recurrence setting could not be confirmed. Refresh the task before trying again.",
        ),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 border-t pt-4">
      <label className="flex items-start gap-3" htmlFor="task-keep-due-time">
        <input
          id="task-keep-due-time"
          type="checkbox"
          checked={checked}
          disabled={pending || (!checked && !policy.canEnable)}
          onChange={(event) => void changeSetting(event.currentTarget.checked)}
          className="mt-1 size-4 accent-primary"
          aria-describedby="task-keep-due-time-description"
        />
        <span>
          <span className="block text-sm font-medium">
            {pending ? "Saving due-time behavior…" : "Keep due time"}
          </span>
          <span
            id="task-keep-due-time-description"
            className="mt-1 block text-sm text-muted-foreground"
          >
            This affects future renewals only. It does not change the current due date or History.
          </span>
        </span>
      </label>
      {notice ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
