import { RotateCcwIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function DraftRecovery({
  dirty,
  disabled,
  onRestore,
  onDismiss,
}: {
  dirty: boolean;
  disabled: boolean;
  onRestore: () => void;
  onDismiss: () => boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const [failed, setFailed] = useState(false);
  function discard() {
    if (onDismiss()) setConfirm(false);
    else setFailed(true);
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>A local draft is available.</span>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={dirty || disabled}
        onClick={onRestore}
      >
        <RotateCcwIcon aria-hidden="true" className="size-4" /> Restore draft
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11"
        disabled={disabled}
        onClick={() => (dirty ? onDismiss() : setConfirm(true))}
      >
        {dirty ? (
          <XIcon aria-hidden="true" className="size-4" />
        ) : (
          <Trash2Icon aria-hidden="true" className="size-4" />
        )}
        {dirty ? "Dismiss draft notice" : "Discard saved draft"}
      </Button>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>Discard this comment’s saved draft?</DialogTitle>
          <DialogDescription>
            This removes the saved draft from this browser. Posted comments and uploaded task
            attachments are not deleted.
          </DialogDescription>
          {failed ? (
            <p role="alert" className="text-sm text-destructive">
              The saved draft could not be removed. Browser storage is unavailable.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setConfirm(false)}
            >
              Keep draft
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={disabled}
              onClick={discard}
            >
              <Trash2Icon aria-hidden="true" className="size-4" /> Discard saved draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
