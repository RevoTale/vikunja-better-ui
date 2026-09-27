import { skipToken, useFragment, useQuery } from "@apollo/client/react";
import { CornerUpLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DiscussionCommentFragmentDoc, DiscussionOriginalDocument } from "@/graphql/graphql";
import { AuthorAvatar } from "./author-avatar";

export function ReplyQuote({
  taskId,
  sourceId,
  onOriginal,
  children,
}: {
  taskId: string;
  sourceId: string;
  onOriginal: (id: string) => void;
  children: ReactNode;
}) {
  const cached = useFragment({
    fragment: DiscussionCommentFragmentDoc,
    from: { __typename: "TaskComment", id: sourceId },
  });
  const original = useQuery(
    DiscussionOriginalDocument,
    cached.complete
      ? skipToken
      : {
          variables: { taskId, commentId: sourceId },
          fetchPolicy: "cache-first",
        },
  );
  const author = cached.complete ? cached.data.author : original.data?.taskComment.author;
  const name = author
    ? author.name || author.username
    : original.loading
      ? "Loading author…"
      : "Author unavailable";
  return (
    <blockquote data-comment-id={sourceId}>
      <div data-quote-author className="mb-1 flex min-w-0 items-center gap-2 text-sm not-italic">
        <AuthorAvatar
          key={author?.username ?? "unknown"}
          name={author ? name : "?"}
          {...(author ? { username: author.username } : {})}
        />
        <span className="min-w-0 text-sm font-normal text-muted-foreground wrap-anywhere">
          {name}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8 shrink-0 [&_svg]:size-3.5"
          aria-label="View original"
          title="View original"
          onClick={() => onOriginal(sourceId)}
        >
          <CornerUpLeftIcon aria-hidden="true" />
        </Button>
      </div>
      <div>{children}</div>
    </blockquote>
  );
}
