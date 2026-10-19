import { RefreshCw, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LoadFailureProps = {
  children: ReactNode;
  className?: string;
  onRetry?: () => void;
  retryDisabled?: boolean;
};

export function LoadFailure({
  children,
  className,
  onRetry,
  retryDisabled = false,
}: LoadFailureProps) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-md border border-dashed border-destructive/50 p-6 text-center text-sm text-destructive",
        className,
      )}
      role="alert"
    >
      <p>{children}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={retryDisabled}
            onClick={onRetry}
          >
            <RotateCcw aria-hidden="true" /> Try again
          </Button>
        ) : null}
        <ReloadPageButton />
      </div>
    </div>
  );
}

export function ReloadPageButton({
  label = "Reload page",
  onReload = reloadPage,
}: {
  label?: string;
  onReload?: () => void;
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onReload}>
      <RefreshCw aria-hidden="true" /> {label}
    </Button>
  );
}

function reloadPage() {
  window.location.reload();
}
