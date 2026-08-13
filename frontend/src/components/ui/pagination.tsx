import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function Pagination({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      aria-label="pagination"
      data-slot="pagination"
      className={cn("flex w-full justify-center", className)}
      {...props}
    />
  );
}

export function PaginationContent({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  );
}

export function PaginationItem(props: ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationButtonProps = ComponentProps<"button"> & { isActive?: boolean };

export function PaginationButton({ className, isActive, ...props }: PaginationButtonProps) {
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      className={cn(
        buttonVariants({ variant: isActive ? "outline" : "ghost", size: "compact" }),
        "min-w-9 px-3",
        className,
      )}
      {...props}
    />
  );
}

export function PaginationPrevious({ children = "Previous", ...props }: PaginationButtonProps) {
  return (
    <PaginationButton aria-label="Go to previous page" {...props}>
      <ChevronLeft className="size-5" />
      <span className="hidden sm:inline">{children}</span>
    </PaginationButton>
  );
}

export function PaginationNext({ children = "Next", ...props }: PaginationButtonProps) {
  return (
    <PaginationButton aria-label="Go to next page" {...props}>
      <span className="hidden sm:inline">{children}</span>
      <ChevronRight className="size-5" />
    </PaginationButton>
  );
}

export function PaginationEllipsis({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="size-5" />
      <span className="sr-only">More pages</span>
    </span>
  );
}
