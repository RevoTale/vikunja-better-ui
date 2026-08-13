import type { HTMLAttributes, LabelHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Field({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="field" className={cn("grid gap-2", className)} {...props} />;
}

type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement> & { htmlFor: string };

export function FieldLabel({ children, className, htmlFor, ...props }: FieldLabelProps) {
  return (
    <label
      data-slot="field-label"
      className={cn("text-sm font-medium", className)}
      htmlFor={htmlFor}
      {...props}
    >
      {children}
    </label>
  );
}

export function FieldError({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  if (!children) {
    return null;
  }
  return (
    <p data-slot="field-error" className={cn("text-sm text-destructive", className)} {...props}>
      {children}
    </p>
  );
}
