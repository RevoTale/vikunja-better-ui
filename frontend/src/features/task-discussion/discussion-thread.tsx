import { useQuery } from "@apollo/client/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type DiscussionCommentFragment,
  DiscussionCommentsDocument,
  type DiscussionOrder,
  SessionDocument,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { CommentCard } from "./comment-card";
import { CommentComposer } from "./comment-composer";
import { DiscussionControls } from "./discussion-controls";
import { replyQuote } from "./html";
import { OriginalComment } from "./original-comment";
import { ReplyNavigation } from "./reply-navigation";
import { useReplyNavigation } from "./use-reply-navigation";
import "./discussion.css";

export function DiscussionThread({ taskId }: { taskId: string }) {
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<DiscussionOrder>("ASC");
  const [reply, setReply] = useState<{ quote: string } | null>(null);
  const navigation = useReplyNavigation();
  const current = navigation.current;
  const [refreshError, setRefreshError] = useState("");
  const session = useQuery(SessionDocument);
  const comments = useQuery(DiscussionCommentsDocument, {
    variables: { taskId, page, order },
    fetchPolicy: "network-only",
  });
  const access =
    session.data?.session.vikunjaUser && session.data.session.csrfToken
      ? { authorId: session.data.session.vikunjaUser.id, csrfToken: session.data.session.csrfToken }
      : undefined;
  const list = comments.data?.taskComments;

  function refresh(revealNew = false) {
    setRefreshError("");
    return comments
      .refetch()
      .then(({ data }) => {
        const last = Math.max(1, data?.taskComments.totalPages ?? 1);
        if (revealNew) setPage(order === "ASC" ? last : 1);
        else if (page > last) setPage(last);
        return true;
      })
      .catch((caught: unknown) => {
        setRefreshError(
          graphQLErrorMessage(caught, "Comments could not be refreshed. Your draft is unchanged."),
        );
        return false;
      });
  }

  function startReply(comment: DiscussionCommentFragment) {
    setReply({ quote: replyQuote(comment.id, comment.bodyHtml) });
    document.getElementById("discussion-composer")?.scrollIntoView({ block: "center" });
  }

  return (
    <div className="min-w-0 space-y-5">
      <DiscussionControls
        loading={comments.loading}
        order={order}
        onRefresh={() => refresh()}
        onOrderChange={(value) => {
          navigation.reset();
          setPage(1);
          setOrder(value);
        }}
      />
      {comments.error || refreshError ? (
        <p role="alert" className="text-destructive">
          {refreshError || graphQLErrorMessage(comments.error, "Comments could not be loaded.")}
        </p>
      ) : null}
      {comments.loading && !list ? <p role="status">Loading comments…</p> : null}
      {list?.items.length === 0 ? (
        <p className="py-4 text-muted-foreground">No comments yet. Start the discussion below.</p>
      ) : null}
      <section aria-label="Comments" aria-busy={comments.loading}>
        {list?.items.map((comment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            taskId={taskId}
            access={access}
            onChanged={() => refresh()}
            onReply={startReply}
            onOriginal={(id) => navigation.follow(comment.id, id)}
            navigation={
              current?.id === comment.id && !current.dialog && navigation.depth > 0 ? (
                <ReplyNavigation depth={navigation.depth} onBack={navigation.back} />
              ) : null
            }
          />
        ))}
      </section>
      {list && (list.totalPages > 1 || page > 1) ? (
        <nav aria-label="Comment pages" className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={page <= 1 || comments.loading}
            onClick={() => {
              navigation.reset();
              setPage(page - 1);
            }}
          >
            Previous comments
          </Button>
          <span className="text-sm">
            Page {page} of {Math.max(1, list.totalPages)}
          </span>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!list.hasMore || comments.loading}
            onClick={() => {
              navigation.reset();
              setPage(page + 1);
            }}
          >
            Next comments
          </Button>
        </nav>
      ) : null}
      <section id="discussion-composer" className="scroll-mt-28 space-y-3 pb-6">
        <h2 className="text-lg font-semibold">Add a comment</h2>
        {access ? (
          <CommentComposer
            key={`${taskId}:${access.authorId}`}
            taskId={taskId}
            {...access}
            reply={reply}
            onSaved={() => {
              setReply(null);
              refresh(true);
            }}
          />
        ) : (
          <>
            <p role="status">
              {session.loading
                ? "Loading comment permissions…"
                : "Your Vikunja identity could not be loaded. Comments remain read-only."}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void session.refetch().catch(() => undefined);
              }}
            >
              Retry permissions
            </Button>
          </>
        )}
      </section>
      {current?.dialog ? (
        <OriginalComment
          taskId={taskId}
          commentId={current.id}
          onOriginal={(id) => navigation.follow(current.id, id)}
          onClose={navigation.close}
          navigation={<ReplyNavigation depth={navigation.depth} onBack={navigation.back} />}
        />
      ) : null}
    </div>
  );
}
