import { useMutation } from "@apollo/client/react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DeleteDiscussionCommentDocument, type DiscussionCommentFragment } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { AuthorAvatar } from "./author-avatar";
import { CommentBody } from "./comment-body";
import { CommentComposer } from "./comment-composer";
import { commentText, hasUnsupportedContent } from "./html";

export type DiscussionAccess = { authorId: string; csrfToken: string };

export function CommentCard({
  comment,
  taskId,
  access,
  onChanged,
  onReply,
  onOriginal,
  navigation,
}: {
  comment: DiscussionCommentFragment;
  taskId: string;
  access: DiscussionAccess | undefined;
  onChanged: () => void;
  onReply: (comment: DiscussionCommentFragment) => void;
  onOriginal: (id: string) => void;
  navigation?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [remove, removal] = useMutation(DeleteDiscussionCommentDocument);
  const article = useRef<HTMLElement>(null);
  const inFlight = useRef(false);
  const own = access?.authorId === comment.author.id;
  const authorName = comment.author.name || comment.author.username;
  const unsupported = hasUnsupportedContent(comment.bodyHtml);

  function finishEdit() {
    setEditing(false);
    article.current?.focus();
  }

  async function deleteComment() {
    if (!access || inFlight.current) return;
    inFlight.current = true;
    setError("");
    try {
      const result = await remove({
        variables: { input: { taskId, commentId: comment.id, csrfToken: access.csrfToken } },
      });
      if (!result.data?.deleteTaskComment.deletedCommentId) throw new Error("Missing confirmation");
      setConfirmDelete(false);
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
    <article
      ref={article}
      id={`comment-${comment.id}`}
      tabIndex={-1}
      className="scroll-mt-28 space-y-3 rounded-lg border-b px-2 py-5 outline-none focus:ring-2 focus:ring-ring"
    >
      {navigation}
      <header className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <AuthorAvatar
            key={comment.author.username}
            name={authorName}
            username={comment.author.username}
          />
          <span
            data-comment-author
            className="min-w-0 text-base font-semibold text-foreground wrap-anywhere"
          >
            {authorName}
          </span>
        </div>
        <time
          dateTime={comment.createdAt}
          title={new Date(comment.createdAt).toLocaleString()}
          className="text-xs text-muted-foreground"
        >
          {new Date(comment.createdAt).toLocaleString()}
          {comment.updatedAt !== comment.createdAt ? " · Edited" : ""}
        </time>
      </header>
      {editing && access && !unsupported ? (
        <CommentComposer
          key={comment.id}
          taskId={taskId}
          {...access}
          commentId={comment.id}
          initialHtml={comment.bodyHtml}
          onSaved={() => {
            finishEdit();
            onChanged();
          }}
          onCancel={finishEdit}
        />
      ) : (
        <>
          <CommentBody html={comment.bodyHtml} taskId={taskId} onOriginal={onOriginal} />
          {unsupported ? (
            <p className="text-sm text-muted-foreground">
              This comment contains content not supported here. Open native Vikunja to view or edit
              it without losing content.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {access ? (
              <Button variant="ghost" className="min-h-11" onClick={() => onReply(comment)}>
                Reply
              </Button>
            ) : null}
            {own ? (
              <>
                <Button
                  variant="ghost"
                  className="min-h-11"
                  disabled={unsupported}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
                <Button variant="ghost" className="min-h-11" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        </>
      )}
      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!removal.loading) setConfirmDelete(open);
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
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
