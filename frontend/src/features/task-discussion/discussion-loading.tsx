import { LoadingPlaceholder } from "@/components/loading-placeholder";

export function CommentsLoading() {
  return (
    <div role="status" aria-label="Loading comments" className="space-y-4">
      <span className="sr-only">Loading comments…</span>
      {[0, 1].map((key) => (
        <div key={key} className="space-y-2 rounded-xl border bg-card p-3 shadow-xs sm:px-4">
          <div className="flex items-center gap-2">
            <LoadingPlaceholder className="size-6 rounded-full" />
            <LoadingPlaceholder className="h-4 w-28" />
          </div>
          <LoadingPlaceholder className="h-4 w-5/6" />
          <LoadingPlaceholder className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function EditorLoading({ media = true }: { media?: boolean }) {
  return (
    <div role="status" aria-label="Loading editor" className="rounded-lg border bg-background">
      <span className="sr-only">Loading editor…</span>
      <div className="space-y-1 border-b p-1">
        <div className="flex h-11 items-center gap-2 px-2">
          <LoadingPlaceholder className="h-5 w-8" />
          <LoadingPlaceholder className="h-5 w-8" />
          <LoadingPlaceholder className="h-5 w-24" />
        </div>
        <div className="flex h-11 items-center px-2 sm:hidden">
          <LoadingPlaceholder className="h-5 w-40" />
        </div>
      </div>
      {media ? (
        <div className="border-b p-2">
          <div className="flex h-11 items-center px-2">
            <LoadingPlaceholder className="h-4 w-40" />
          </div>
        </div>
      ) : null}
      <div className="min-h-32 p-3">
        <LoadingPlaceholder className="h-4 w-1/3" />
      </div>
    </div>
  );
}
