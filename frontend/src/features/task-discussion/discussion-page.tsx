import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { DiscussionHeader } from "./discussion-header";
import { DiscussionThread } from "./discussion-thread";

export function DiscussionPage({
  taskId,
  returnTo,
  commentId,
}: {
  taskId: string;
  returnTo: string;
  commentId: string | undefined;
}) {
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <Link
        to="/tasks/$taskId"
        params={{ taskId }}
        search={{ returnTo }}
        className={buttonVariants({ variant: "ghost" })}
      >
        Back to task
      </Link>
      <DiscussionHeader taskId={taskId} />
      <DiscussionThread key={taskId} taskId={taskId} linkedCommentId={commentId} />
    </section>
  );
}
