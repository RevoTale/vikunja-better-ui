import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export function OfflineScreen() {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
      <BrandMark className="size-12" />
      <h1 className="text-xl font-semibold">You're offline</h1>
      <p className="text-muted-foreground">
        Better Vikunja is ready. Connect to load fresh tasks and make changes. Task data is not
        stored offline.
      </p>
      <Button className="self-start" onClick={() => window.location.reload()}>
        Retry
      </Button>
    </main>
  );
}
