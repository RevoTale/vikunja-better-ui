import { useMemo } from "react";
import { CommentBody } from "@/features/task-discussion/comment-body";
import { cleanComment, hasUnsupportedContent } from "@/features/task-discussion/html";
import "@/features/task-discussion/discussion.css";

export function TaskDescription({ description }: { description: string }) {
  const content = useMemo(() => {
    const html = new DOMParser().parseFromString(cleanComment(description), "text/html");
    const isPlain =
      html.body.childElementCount === 0 &&
      html.body.textContent === description.replace(/\r\n?/g, "\n");
    return { isPlain, unsupported: !isPlain && hasUnsupportedContent(description) };
  }, [description]);
  return (
    <section aria-label="Description" className="min-w-0 space-y-3 py-6">
      <h2 className="sr-only">Description</h2>
      {description.trim() ? (
        content.isPlain ? (
          <p className="whitespace-pre-wrap text-base leading-relaxed wrap-anywhere">
            {description}
          </p>
        ) : (
          <CommentBody html={description} />
        )
      ) : (
        <p className="text-sm text-muted-foreground">No description yet.</p>
      )}
      {content.unsupported ? (
        <p className="text-sm text-muted-foreground">
          Some description content cannot be displayed here. Open native Vikunja for the full
          description.
        </p>
      ) : null}
    </section>
  );
}
