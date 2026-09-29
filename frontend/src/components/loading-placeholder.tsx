import { cn } from "@/lib/utils";

export function LoadingPlaceholder({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block rounded bg-muted motion-safe:animate-pulse", className)}
    />
  );
}
