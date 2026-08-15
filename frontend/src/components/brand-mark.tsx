import type { SVGProps } from "react";

import { cn } from "@/lib/cn";

export function BrandMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0", className)}
      data-slot="brand-mark"
      focusable="false"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="64" height="64" rx="16" fill="#2e2e2e" />
      <rect x="20" y="10" width="34" height="38" rx="9" fill="#8e8a83" />
      <rect x="10" y="16" width="40" height="38" rx="10" fill="#e9e4d8" />
      <path
        d="m21 35 7 7 14-16"
        fill="none"
        stroke="#2e2e2e"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5"
      />
      <path
        d="M55.25 50a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 1 1 10.5 0Zm-2 0a3.25 3.25 0 1 1-6.5 0 3.25 3.25 0 1 1 6.5 0ZM50 43v2m0 10v2m-7-7h2m10 0h2m-11.9-4.9 1.4 1.4m7 7 1.4 1.4m0-9.8-1.4 1.4m-7 7-1.4 1.4"
        fill="none"
        opacity="0.15"
        stroke="#222"
        strokeLinecap="round"
        strokeWidth="1.25"
      />
      <path d="M51 50a1 1 0 1 1-2 0 1 1 0 1 1 2 0Z" fill="#222" opacity="0.15" />
    </svg>
  );
}
