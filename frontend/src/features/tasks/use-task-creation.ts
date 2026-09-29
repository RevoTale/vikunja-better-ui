import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { type FormEvent, useState } from "react";
import { graphQLErrorMessage } from "@/lib/user-error";
import {
  type CreationBaseType,
  hasTaskFormErrors,
  serverTaskFormErrors,
  type TaskFormErrors,
  validateTaskForm,
} from "./task-form-validation";
import { type CreatePayload, useCreateTaskMutation } from "./use-create-task-mutation";

export function useTaskCreation(
  baseType: CreationBaseType,
  csrfToken: string | null | undefined,
  onCreated: (payload: CreatePayload) => Promise<void>,
  setError: (error: string) => void,
) {
  const { createValidatedTask, loading } = useCreateTaskMutation(baseType);
  const [fieldErrors, setFieldErrors] = useState<TaskFormErrors>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const validationErrors = validateTaskForm(baseType, form);
    if (hasTaskFormErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      focusFirstInvalid(formElement, validationErrors);
      return;
    }
    setFieldErrors({});
    if (!csrfToken) {
      setError("Your session is unavailable. Refresh the page and sign in again.");
      return;
    }
    try {
      const payload: CreatePayload | undefined = await createValidatedTask(form, csrfToken);
      if (!payload) throw new Error("empty result");
      await onCreated(payload);
    } catch (caught) {
      showCreationError(caught, form, formElement);
    }
  }

  function showCreationError(caught: unknown, form: FormData, formElement: HTMLFormElement) {
    const validationMessage = graphQLValidationMessage(caught);
    const serverErrors = validationMessage
      ? serverTaskFormErrors(baseType, form, validationMessage)
      : {};
    if (hasTaskFormErrors(serverErrors)) {
      setFieldErrors(serverErrors);
      focusFirstInvalid(formElement, serverErrors);
      return;
    }
    setError(
      graphQLErrorMessage(
        caught,
        "The task could not be created. Refresh the relevant list before trying again if the result is uncertain.",
      ),
    );
  }

  return { submit, loading, fieldErrors, setFieldErrors };
}
function focusFirstInvalid(form: HTMLFormElement, errors: TaskFormErrors) {
  const firstName = Object.keys(errors)[0];
  if (!firstName) return;
  const field =
    form.querySelector<HTMLElement>(`[data-form-field="${firstName}"]`) ??
    form.elements.namedItem(firstName);
  if (field instanceof HTMLElement) requestAnimationFrame(() => field.focus());
}
function graphQLValidationMessage(error: unknown): string | undefined {
  if (!CombinedGraphQLErrors.is(error)) return undefined;
  return error.errors.find((item) => {
    const code = item.extensions?.["code"];
    return code === "VALIDATION_FAILED" || code === "FORBIDDEN";
  })?.message;
}
