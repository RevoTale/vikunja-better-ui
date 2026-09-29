import { useQuery } from "@apollo/client/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type DiscussionCommentFragment,
  DiscussionCommentsDocument,
  type DiscussionCommentsQuery,
  type DiscussionOrder,
  SessionDocument,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { CommentCard } from "./comment-card";
import { CommentComposer } from "./comment-composer";
import { DiscussionControls } from "./discussion-controls";
import { CommentsLoading, EditorLoading } from "./discussion-loading";
import { replyQuote } from "./html";
import { OriginalComment } from "./original-comment";
import { ReplyNavigation } from "./reply-navigation";
import { useReplyNavigation } from "./use-reply-navigation";
import "./discussion.css";

export function DiscussionThread({
  taskId,
  linkedCommentId,
}: {
  taskId: string;
  linkedCommentId?: string | undefined;
}) {
  const { session, comments, access, list, page, setPage, order, setOrder, refresh } =
    useDiscussionData(taskId);
  const [reply, setReply] = useState<{ quote: string } | null>(null);
  const navigation = useReplyNavigation(linkedCommentId, Boolean(list));
  const current = navigation.current;

  function startReply(comment: DiscussionCommentFragment) {
    setReply({ quote: replyQuote(comment.id, comment.bodyHtml) });
    document.getElementById("discussion-composer")?.scrollIntoView({ block: "center" });
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="space-y-1">
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
        <p role="status" className="min-h-5 text-xs text-muted-foreground">
          <span
            className={
              comments.loading && list
                ? "opacity-100 motion-safe:transition-opacity motion-safe:duration-150"
                : "invisible opacity-0"
            }
          >
            Updating comments…
          </span>
        </p>
      </div>
      <DiscussionError error={comments.error} retained={Boolean(list)} />
      {list?.items.length === 0 ? (
        <p className="py-4 text-muted-foreground">No comments yet. Start the discussion below.</p>
      ) : null}
      <section aria-label="Comments" aria-busy={comments.loading} className="space-y-4">
        {comments.loading && !list ? <CommentsLoading /> : null}
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
      <CommentPages
        list={list}
        page={page}
        loading={comments.loading}
        onPageChange={(next) => {
          navigation.reset();
          setPage(next);
        }}
      />
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
          <CommentPermissions
            loading={session.loading}
            retry={() => {
              void session.refetch().catch(() => undefined);
            }}
          />
        )}
      </section>
      {current?.dialog ? (
        <OriginalComment
          taskId={taskId}
          commentId={current.id}
          onOriginal={(id) => navigation.follow(current.id, id)}
          onClose={navigation.close}
          navigation={
            navigation.depth > 0 ? (
              <ReplyNavigation depth={navigation.depth} onBack={navigation.back} />
            ) : null
          }
        />
      ) : null}
    </div>
  );
}

function CommentPermissions({ loading, retry }: { loading: boolean; retry: () => void }) {
  if (loading) return <EditorLoading />;
  return (
    <>
      <p role="status">Your Vikunja identity could not be loaded. Comments remain read-only.</p>
      <Button variant="outline" onClick={retry}>
        Retry permissions
      </Button>
    </>
  );
}

function DiscussionError({ error, retained }: { error: unknown; retained: boolean }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-destructive">
      {graphQLErrorMessage(error, "Comments could not be loaded. Your draft is unchanged.")}
      {retained ? " Displayed comments are from the previous successful load." : ""}
    </p>
  );
}

function useDiscussionData(taskId: string) {
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<DiscussionOrder>("ASC");
  const session = useQuery(SessionDocument);
  const comments = useQuery(DiscussionCommentsDocument, {
    variables: { taskId, page, order },
    fetchPolicy: "cache-and-network",
  });
  const access =
    session.data?.session.vikunjaUser && session.data.session.csrfToken
      ? { authorId: session.data.session.vikunjaUser.id, csrfToken: session.data.session.csrfToken }
      : undefined;
  const list = comments.data?.taskComments ?? comments.previousData?.taskComments;
  function refresh(revealNew = false) {
    return comments
      .refetch()
      .then(({ data }) => {
        const last = Math.max(1, data?.taskComments.totalPages ?? 1);
        if (revealNew) setPage(order === "ASC" ? last : 1);
        else if (page > last) setPage(last);
        return true;
      })
      .catch(() => false);
  }

  return { session, comments, access, list, page, setPage, order, setOrder, refresh };
}

function CommentPages({
  list,
  page,
  loading,
  onPageChange,
}: {
  list: DiscussionCommentsQuery["taskComments"] | undefined;
  page: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <>
      {list && (list.totalPages > 1 || page > 1) ? (
        <nav aria-label="Comment pages" className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={list.page <= 1 || loading}
            onClick={() => {
              onPageChange(list.page - 1);
            }}
          >
            Previous comments
          </Button>
          <span className="text-sm">
            Page {list.page} of {Math.max(1, list.totalPages)}
          </span>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!list.hasMore || loading}
            onClick={() => {
              onPageChange(list.page + 1);
            }}
          >
            Next comments
          </Button>
        </nav>
      ) : null}
    </>
  );
}
