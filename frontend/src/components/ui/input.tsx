import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";
import { formControlSurface } from "./form-control";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      data-slot="input"
      className={cn(
        formControlSurface,
        "h-11 min-w-0 px-3 py-2 text-base placeholder:text-muted-foreground md:text-sm",
        className,
      )}
      {...props}
    />
  );
}
