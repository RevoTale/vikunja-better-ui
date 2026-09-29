import { useQuery } from "@apollo/client/react";
import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DiscussionOriginalDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { CommentBody } from "./comment-body";
import { CommentsLoading } from "./discussion-loading";

export function OriginalComment({
  taskId,
  commentId,
  onClose,
  onOriginal,
  navigation,
}: {
  taskId: string;
  commentId: string;
  onClose: () => void;
  onOriginal: (id: string) => void;
  navigation: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (commentId) heading.current?.focus();
  }, [commentId]);
  const { data, loading, error, refetch } = useQuery(DiscussionOriginalDocument, {
    variables: { taskId, commentId },
    fetchPolicy: "network-only",
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent finalFocus={false} className="max-h-[80dvh] overflow-y-auto sm:max-w-xl">
        <DialogTitle ref={heading} tabIndex={-1}>
          Original comment
        </DialogTitle>
        <DialogDescription>Referenced comment in this task.</DialogDescription>
        {navigation}
        {loading ? (
          <div role="status" aria-label="Loading original comment">
            <span className="sr-only">Loading original…</span>
            <CommentsLoading />
          </div>
        ) : null}
        {error ? (
          <>
            <p role="alert">
              {graphQLErrorMessage(error, "Original comment is unavailable or has been deleted.")}
            </p>
            <Button
              onClick={() => {
                void refetch().catch(() => undefined);
              }}
            >
              Retry
            </Button>
          </>
        ) : null}
        {!loading && !error && data ? (
          <>
            <p className="text-base font-semibold text-foreground">
              {data.taskComment.author.name || data.taskComment.author.username}
            </p>
            <CommentBody html={data.taskComment.bodyHtml} taskId={taskId} onOriginal={onOriginal} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
