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
  action,
}: {
  name: TaskFormField;
  label: ReactNode;
  error: string | undefined;
  children: (attributes: ControlAttributes) => ReactNode;
  action?: ReactNode;
}) {
  const errorID = `${name}-error`;
  const attributes: ControlAttributes = {
    ...(error ? { "aria-invalid": true as const } : {}),
    ...(error ? { "aria-describedby": errorID } : {}),
  };

  return (
    <Field data-invalid={Boolean(error)}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        {action}
      </div>
      {children(attributes)}
      <FieldError id={errorID}>{error}</FieldError>
    </Field>
  );
}
