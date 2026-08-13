import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

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

export function FieldError({ children }: { children: ReactNode }) {
  if (!children) {
    return null;
  }
  return (
    <p data-slot="field-error" className="text-sm text-destructive">
      {children}
    </p>
  );
}
