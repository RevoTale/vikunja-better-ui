import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";
import { formControlSurface } from "./form-control";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        formControlSurface,
        "min-h-28 px-3 py-2 text-base placeholder:text-muted-foreground md:text-sm",
        className,
      )}
      {...props}
    />
  );
}
