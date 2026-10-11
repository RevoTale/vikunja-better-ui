import { LoadingPlaceholder } from "@/components/loading-placeholder";

export function TaskDetailLoading() {
  return (
    <section role="status" aria-label="Loading task" className="mx-auto max-w-6xl min-w-0">
      <span className="sr-only">Loading task…</span>
      <div className="mb-5 flex flex-wrap justify-between gap-2 border-b pb-3">
        <LoadingPlaceholder className="h-11 w-16" />
        <div className="flex w-full gap-2 sm:w-auto">
          <LoadingPlaceholder className="h-11 w-28" />
          <LoadingPlaceholder className="h-11 w-16" />
          <LoadingPlaceholder className="size-11" />
        </div>
      </div>
      <div className="grid min-w-0 gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <LoadingPlaceholder className="h-4 w-1/3" />
          <LoadingPlaceholder className="h-9 w-3/4" />
          <LoadingPlaceholder className="h-11 w-24" />
          <LoadingPlaceholder className="h-16 w-full" />
        </div>
        <div className="min-w-0 space-y-2 border-y py-4 lg:row-span-3 lg:border-y-0 lg:border-l lg:py-0 lg:pl-6">
          <LoadingPlaceholder className="h-4 w-24" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((key) => (
            <LoadingPlaceholder key={key} className="h-9 w-full" />
          ))}
        </div>
        <LoadingPlaceholder className="h-40 w-full lg:col-start-1" />
      </div>
    </section>
  );
}
