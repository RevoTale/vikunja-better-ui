import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";
import { formControlSurface } from "./form-control";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div data-slot="select-wrapper" className="relative">
      <select
        data-slot="select"
        className={cn(
          formControlSurface,
          "h-11 min-w-0 appearance-none px-3 py-2 pr-9 text-base md:text-sm",
          className,
        )}
        {...props}
      />
      <ChevronDown
        data-slot="select-icon"
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
