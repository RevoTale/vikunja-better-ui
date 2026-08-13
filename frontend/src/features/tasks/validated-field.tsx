import type { ReactNode } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import type { TaskFormField } from "./task-form-validation";

type ControlAttributes = {
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function ValidatedField({
  name,
  label,
  error,
  children,
}: {
  name: TaskFormField;
  label: ReactNode;
  error: string | undefined;
  children: (attributes: ControlAttributes) => ReactNode;
}) {
  const errorID = `${name}-error`;
  const attributes: ControlAttributes = error
    ? { "aria-invalid": true, "aria-describedby": errorID }
    : {};

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      {children(attributes)}
      <FieldError id={errorID}>{error}</FieldError>
    </Field>
  );
}
