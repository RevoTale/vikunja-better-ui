import { useMutation } from "@apollo/client/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DeleteDiscussionCommentDocument, type DiscussionCommentFragment } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import type { DiscussionAccess } from "./comment-card";
import { commentText } from "./html";

export function CommentDeleteDialog({
  comment,
  taskId,
  access,
  open,
  onOpenChange,
  onChanged,
}: {
  comment: DiscussionCommentFragment;
  taskId: string;
  access: DiscussionAccess | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [error, setError] = useState("");
  const [remove, removal] = useMutation(DeleteDiscussionCommentDocument);
  const inFlight = useRef(false);

  async function deleteComment() {
    if (!access || inFlight.current) return;
    inFlight.current = true;
    setError("");
    try {
      const result = await remove({
        variables: { input: { taskId, commentId: comment.id, csrfToken: access.csrfToken } },
      });
      if (!result.data?.deleteTaskComment.deletedCommentId) throw new Error("Missing confirmation");
      onOpenChange(false);
      onChanged();
    } catch (caught) {
      setError(
        graphQLErrorMessage(
          caught,
          "Deletion could not be confirmed. Refresh the discussion before trying again.",
        ),
      );
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!removal.loading) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogTitle>Delete comment?</DialogTitle>
        <DialogDescription>
          Remove “{commentText(comment.bodyHtml).slice(0, 100)}” by{" "}
          {comment.author.name || comment.author.username}? This cannot be undone.
        </DialogDescription>
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            className="min-h-11"
            disabled={removal.loading}
            onClick={deleteComment}
          >
            {removal.loading ? "Deleting…" : "Delete comment"}
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={removal.loading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
