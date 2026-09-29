import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { Card, CardContent } from "@/components/ui/card";

export function TaskListLoading() {
  return (
    <div role="status" aria-label="Loading tasks" className="grid gap-2 sm:gap-3">
      <span className="sr-only">Loading tasks…</span>
      {[0, 1, 2].map((key) => (
        <Card key={key} className="py-0" data-slot="task-loading-row">
          <CardContent className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-3 py-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:px-4 sm:py-3">
            <LoadingPlaceholder className="h-4 w-14" />
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3">
              <LoadingPlaceholder className="h-5 w-3/4" />
              <LoadingPlaceholder className="size-8 rounded-lg" />
            </div>
            <div className="col-span-2 flex min-w-0 items-start gap-2 sm:col-span-1 sm:col-start-2">
              <div className="mr-auto flex h-6 shrink-0 items-center">
                <LoadingPlaceholder className="h-3 w-8" />
              </div>
              <div className="flex min-h-6 min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
                {[0, 1, 2].map((badge) => (
                  <span key={badge} data-slot="task-loading-badge">
                    <LoadingPlaceholder className="h-5 w-12 rounded-full" />
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
