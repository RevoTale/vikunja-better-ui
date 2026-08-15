import type { ImgHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function BrandMark({ className, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      {...props}
      alt=""
      aria-hidden="true"
      className={cn("shrink-0", className)}
      data-slot="brand-mark"
      src="/favicon.svg"
    />
  );
}
