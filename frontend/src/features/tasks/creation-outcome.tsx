import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CreationLabelWarning, CreationRepair } from "./use-created-task-result";
export function CreationRepairPanel({
  repairInfo,
  error,
  repairing,
  continueRepair,
}: {
  repairInfo: CreationRepair;
  error: string;
  repairing: boolean;
  continueRepair: () => Promise<void>;
}) {
  return (
    <section>
      <h1 className="font-serif text-3xl font-semibold">Task created; metadata needs repair</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The task exists in Vikunja. Continue the idempotent repair instead of submitting the form
        again.
      </p>
      <p className="mt-4 text-sm">Remaining: {repairInfo.steps.join(", ")}</p>
      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="mt-5" onClick={continueRepair} disabled={repairing}>
        {repairing ? "Repairing…" : "Continue repair"}
      </Button>
    </section>
  );
}
export function CreationLabelWarningPanel({
  labelWarning,
  returnTo,
}: {
  labelWarning: CreationLabelWarning;
  returnTo: string;
}) {
  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="font-serif text-3xl font-semibold">Task created</h1>
      <p role="alert" className="mt-4">
        {labelWarning.message}
      </p>
      <a
        className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
        href={`/tasks/${labelWarning.taskId}/edit?returnTo=${encodeURIComponent(returnTo)}`}
      >
        Review task labels
      </a>
    </section>
  );
}
