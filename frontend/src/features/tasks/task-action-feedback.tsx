import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { useTaskListActions } from "./use-task-list-actions";

type TaskActions = ReturnType<typeof useTaskListActions>;

export function TaskActionFeedback({ actions }: { actions: TaskActions }) {
  return (
    <>
      <div className="sr-only" aria-live="polite">
        {actions.notice}
      </div>
      {actions.notice ? (
        <p className="mt-4 rounded-md border bg-muted p-3 text-sm" role="status">
          {actions.notice}
        </p>
      ) : null}
      {actions.undo ? (
        <div className="fixed bottom-20 left-4 right-4 z-30 flex items-center justify-between gap-3 rounded-md border bg-card p-3 shadow-lg sm:left-auto sm:right-6 sm:w-96 lg:bottom-6">
          <span className="min-w-0 truncate text-sm">{actions.undo.title} completed</span>
          <Button size="sm" variant="outline" onClick={actions.restore} disabled={actions.undoing}>
            <RotateCcw /> Undo
          </Button>
        </div>
      ) : null}
      {actions.repairInfo ? (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm">
            Renewal is complete. Repair the due-time adjustment or missing Vikunja History entry.
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={actions.repairHistory}
            disabled={actions.repairing}
          >
            {actions.repairing ? "Repairing…" : "Repair history"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
