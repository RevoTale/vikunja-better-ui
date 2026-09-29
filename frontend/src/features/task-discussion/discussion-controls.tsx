import { Check, RefreshCw } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { AppSelect } from "@/components/app-select";
import { Button } from "@/components/ui/button";
import type { DiscussionOrder } from "@/graphql/graphql";

const orders = [
  { value: "ASC", label: "Oldest first" },
  { value: "DESC", label: "Newest first" },
] as const;

export function DiscussionControls({
  loading,
  order,
  onOrderChange,
  onRefresh,
}: {
  loading: boolean;
  order: DiscussionOrder;
  onOrderChange: (order: DiscussionOrder) => void;
  onRefresh: () => Promise<boolean>;
}) {
  const id = useId();
  const [refreshState, setRefreshState] = useState<"idle" | "pending" | "loading" | "success">(
    "idle",
  );
  useEffect(() => {
    if (refreshState !== "pending" && refreshState !== "success") return;
    const next = refreshState === "pending" ? "loading" : "idle";
    const timeout = window.setTimeout(
      () => setRefreshState((current) => (current === refreshState ? next : current)),
      refreshState === "pending" ? 1000 : 2000,
    );
    return () => window.clearTimeout(timeout);
  }, [refreshState]);
  const showLoading = refreshState === "loading";
  const pending = refreshState === "pending" || showLoading;
  const success = refreshState === "success";
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex min-w-36 max-w-64 flex-1 flex-col gap-1">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          Sort comments
        </label>
        <AppSelect
          className="disabled:opacity-100"
          id={id}
          value={order}
          options={orders}
          disabled={loading || pending}
          onValueChange={(value) => {
            setRefreshState("idle");
            onOrderChange(value);
          }}
        />
      </div>
      <Button
        variant="outline"
        className="min-h-11 w-32 disabled:opacity-100"
        aria-label={showLoading ? "Refresh: Refreshing…" : success ? "Refresh: Updated" : "Refresh"}
        disabled={loading || pending}
        onClick={async () => {
          setRefreshState("pending");
          setRefreshState((await onRefresh()) ? "success" : "idle");
        }}
      >
        {success ? (
          <Check aria-hidden="true" />
        ) : (
          <RefreshCw
            aria-hidden="true"
            className={showLoading ? "animate-spin motion-reduce:animate-none" : ""}
          />
        )}
        {showLoading ? "Refreshing…" : success ? "Updated" : "Refresh"}
      </Button>
      <span role="status" className="sr-only">
        {success ? "Comments refreshed." : ""}
      </span>
    </div>
  );
}
