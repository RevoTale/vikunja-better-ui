import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type {
  RelatedTaskFieldsFragment,
  SetTaskRelationInput,
  TaskRelationKind,
} from "@/graphql/graphql";

export type RelationRemoval = {
  task: RelatedTaskFieldsFragment;
  kind: TaskRelationKind;
};

export function RelationRemovalDialog({
  taskId,
  title,
  removal,
  pending,
  error,
  change,
  onClose,
}: {
  taskId: string;
  title: string;
  removal: RelationRemoval;
  pending: boolean;
  error: string;
  change: (input: Omit<SetTaskRelationInput, "csrfToken">) => Promise<boolean>;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>Unlink tasks?</DialogTitle>
        <DialogDescription>
          Remove the relationship between “{title}” and “{removal.task.title}”? Neither task will be
          deleted.
        </DialogDescription>
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          variant="destructive"
          disabled={pending}
          onClick={async () => {
            if (
              await change({
                taskId,
                otherTaskId: removal.task.id,
                kind: removal.kind,
                remove: true,
              })
            )
              onClose();
          }}
        >
          Unlink tasks
        </Button>
        <Button variant="outline" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
