import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InlineTaskEditing } from "./use-inline-task-editing";

export function InlineEditorActions({
  editor,
  disabled = false,
}: {
  editor: InlineTaskEditing;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" disabled={editor.pending || editor.blocked || disabled}>
        <Check /> {editor.pending ? "Saving…" : "Save"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={editor.pending || disabled}
        onClick={editor.cancel}
      >
        <X /> Cancel
      </Button>
    </div>
  );
}

export function InlineEditorFeedback({ editor }: { editor: InlineTaskEditing }) {
  return (
    <>
      {editor.error ? (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{editor.error}</p>
          {editor.blocked ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={editor.pending}
              onClick={() => void editor.reload()}
            >
              Reload task and discard edits
            </Button>
          ) : null}
        </div>
      ) : null}
      <span role="status" className="sr-only">
        {editor.notice}
      </span>
    </>
  );
}
