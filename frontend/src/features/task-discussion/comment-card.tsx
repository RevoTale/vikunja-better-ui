import { useMutation } from "@apollo/client/react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DeleteDiscussionCommentDocument, type DiscussionCommentFragment } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { AuthorAvatar } from "./author-avatar";
import { CommentBody } from "./comment-body";
import { CommentComposer } from "./comment-composer";
import { CommentMenu } from "./comment-menu";
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
      className="scroll-mt-28 space-y-2 rounded-xl border bg-card p-3 text-card-foreground shadow-xs outline-none focus:ring-2 focus:ring-ring sm:px-4"
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
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <time
            dateTime={comment.createdAt}
            title={new Date(comment.createdAt).toLocaleString()}
            className="text-xs text-muted-foreground"
          >
            {new Date(comment.createdAt).toLocaleString()}
            {comment.updatedAt !== comment.createdAt ? " · Edited" : ""}
          </time>
          <CommentMenu
            taskId={taskId}
            commentId={comment.id}
            html={comment.bodyHtml}
            own={own && !editing}
            unsupported={unsupported}
            onEdit={() => setEditing(true)}
            onDelete={() => setConfirmDelete(true)}
          />
        </div>
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
          {access ? (
            <div
              data-comment-actions
              className="-mx-3 -mb-3 flex flex-wrap gap-1 rounded-b-xl border-t bg-background/30 px-2 sm:-mx-4 sm:px-3"
            >
              <Button variant="ghost" className="min-h-11" onClick={() => onReply(comment)}>
                Reply
              </Button>
            </div>
          ) : null}
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
