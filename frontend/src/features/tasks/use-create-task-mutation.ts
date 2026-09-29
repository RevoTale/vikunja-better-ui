import { useMutation } from "@apollo/client/react";
import {
  CreateJobDocument,
  type CreateJobMutation,
  CreateOneTimeTaskDocument,
  type CreateOneTimeTaskMutation,
  CreateRecurringTaskDocument,
  type CreateRecurringTaskMutation,
  type RecurrenceMode,
  type RecurrenceUnit,
  type TaskPriority,
} from "@/graphql/graphql";
import { composeLocalDateTime } from "./local-date-time";
import type { CreationBaseType } from "./task-form-validation";

export type CreatePayload =
  | CreateOneTimeTaskMutation["createOneTimeTask"]
  | CreateRecurringTaskMutation["createRecurringTask"]
  | CreateJobMutation["createJob"];

export function useCreateTaskMutation(baseType: CreationBaseType) {
  const [createOneTime, oneTimeState] = useMutation(CreateOneTimeTaskDocument);
  const [createRecurring, recurringState] = useMutation(CreateRecurringTaskDocument);
  const [createJob, jobState] = useMutation(CreateJobDocument);

  async function createValidatedTask(form: FormData, csrfToken: string) {
    const common = {
      csrfToken,
      title: text(form, "title").trim(),
      projectId: text(form, "projectId"),
      priority: text(form, "priority") as TaskPriority,
      labelIds: form.getAll("labelIds").map(String),
      description: optional(form, "description"),
    };
    if (text(form, "job") === "on") {
      return (
        await createJob({
          variables: {
            input: {
              ...common,
              title: common.title || null,
              startAt: requiredJobStart(form),
              durationMinutes: Number(text(form, "durationMinutes")),
              completionWindowMinutes: Number(text(form, "completionWindowMinutes")),
              recurrence: baseType === "recurring" ? formRecurrence(form) : null,
            },
          },
        })
      ).data?.createJob;
    }
    if (baseType === "one-time") {
      return (
        await createOneTime({
          variables: {
            input: {
              ...common,
              dueDate: optional(form, "dueDate"),
              dueTime: optional(form, "dueTime"),
            },
          },
        })
      ).data?.createOneTimeTask;
    }
    return (
      await createRecurring({
        variables: {
          input: {
            ...common,
            firstDueDate: text(form, "firstDueDate"),
            dueTime: optional(form, "dueTime"),
            ...formRecurrence(form),
          },
        },
      })
    ).data?.createRecurringTask;
  }

  return {
    createValidatedTask,
    loading: oneTimeState.loading || recurringState.loading || jobState.loading,
  };
}

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "");
}

function optional(form: FormData, name: string) {
  return text(form, name).trim() || null;
}

function requiredJobStart(form: FormData) {
  const startAt = composeLocalDateTime({
    date: text(form, "startDate"),
    time: text(form, "startTime"),
  });
  if (!startAt) throw new Error("validated job start is unavailable");
  return startAt;
}

function formRecurrence(form: FormData) {
  return {
    interval: Number(text(form, "interval")),
    unit: text(form, "unit") as RecurrenceUnit,
    mode: text(form, "mode") as RecurrenceMode,
    keepDueTime: text(form, "keepDueTime") === "on",
  };
}
