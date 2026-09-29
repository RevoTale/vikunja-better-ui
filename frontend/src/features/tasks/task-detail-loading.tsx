import { LoadingPlaceholder } from "@/components/loading-placeholder";

export function TaskDetailLoading() {
  return (
    <section role="status" aria-label="Loading task" className="mx-auto max-w-6xl min-w-0">
      <span className="sr-only">Loading task…</span>
      <div className="mb-8 flex justify-between border-b pb-4">
        <LoadingPlaceholder className="h-8 w-16" />
        <LoadingPlaceholder className="h-8 w-32" />
      </div>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4">
          <LoadingPlaceholder className="h-4 w-1/3" />
          <LoadingPlaceholder className="h-9 w-3/4" />
          <LoadingPlaceholder className="h-24 w-full" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2, 3].map((key) => (
            <LoadingPlaceholder key={key} className="h-6 w-full" />
          ))}
        </div>
      </div>
    </section>
  );
}
