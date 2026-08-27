import type { ReactNode } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { AutofillIndicator } from "./autofill/autofill-indicator";
import type { TaskFormField } from "./task-form-validation";

type ControlAttributes = {
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function ValidatedField({
  name,
  label,
  error,
  autofilled = false,
  children,
}: {
  name: TaskFormField;
  label: ReactNode;
  error: string | undefined;
  autofilled?: boolean;
  children: (attributes: ControlAttributes) => ReactNode;
}) {
  const errorID = `${name}-error`;
  const autofillID = `${name}-autofill`;
  const describedBy = [autofilled ? autofillID : undefined, error ? errorID : undefined]
    .filter(Boolean)
    .join(" ");
  const attributes: ControlAttributes = {
    ...(error ? { "aria-invalid": true as const } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
  };

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      {children(attributes)}
      {autofilled ? <AutofillIndicator id={autofillID} /> : null}
      <FieldError id={errorID}>{error}</FieldError>
    </Field>
  );
}
