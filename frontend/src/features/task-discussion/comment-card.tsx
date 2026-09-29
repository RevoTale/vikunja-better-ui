import { type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DiscussionCommentFragment } from "@/graphql/graphql";
import { AuthorAvatar } from "./author-avatar";
import { CommentBody } from "./comment-body";
import { CommentComposer } from "./comment-composer";
import { CommentDeleteDialog } from "./comment-delete-dialog";
import { CommentMenu } from "./comment-menu";
import { hasUnsupportedContent } from "./html";

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
  const article = useRef<HTMLElement>(null);
  const own = access?.authorId === comment.author.id;
  const authorName = comment.author.name || comment.author.username;
  const unsupported = hasUnsupportedContent(comment.bodyHtml);

  function finishEdit() {
    setEditing(false);
    article.current?.focus();
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
      <CommentDeleteDialog
        comment={comment}
        taskId={taskId}
        access={access}
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onChanged={onChanged}
      />
    </article>
  );
}
