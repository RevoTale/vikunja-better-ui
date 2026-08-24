import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

export function ListMessage({ children, tone }: { children: string; tone?: "error" }) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground",
        tone === "error" && "border-destructive/50 text-destructive",
      )}
      role={tone === "error" ? "alert" : undefined}
    >
      {children}
    </div>
  );
}

export function IssueList({ issues }: { issues: { code: string; message: string }[] }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4" role="alert">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle /> This list is incomplete
      </p>
      {issues.map((issue) => (
        <p className="mt-2 text-sm" key={`${issue.code}:${issue.message}`}>
          {issue.message}
        </p>
      ))}
    </div>
  );
}
