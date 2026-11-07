import { lazy, Suspense, useState } from "react";
import { CommentBody } from "@/features/task-discussion/comment-body";
import { EditorLoading } from "@/features/task-discussion/discussion-loading";
import { hasUnsupportedContent } from "@/features/task-discussion/html";

const Editor = lazy(() =>
  import("@/features/task-discussion/editor").then((module) => ({
    default: module.DiscussionEditor,
  })),
);

export function TaskDescriptionField({
  initialHtml = "",
  disabled = false,
}: {
  initialHtml?: string;
  disabled?: boolean;
}) {
  // Preserve the exact upstream value until a content edit, including while the editor loads.
  const [html, setHtml] = useState(initialHtml);
  const [activated, setActivated] = useState(Boolean(initialHtml));
  const [unsupported] = useState(() => hasUnsupportedContent(initialHtml));
  return (
    <details
      className="min-w-0 space-y-2"
      open={Boolean(initialHtml)}
      onToggle={(event) => {
        if (event.currentTarget.open) setActivated(true);
      }}
    >
      <summary className="w-fit cursor-pointer rounded-sm py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
        {html ? "Description" : "Add description"}
      </summary>
      <input type="hidden" name="description" value={html} />
      {unsupported ? (
        <>
          <CommentBody html={initialHtml} />
          <p role="status" className="text-sm text-muted-foreground">
            This description contains formatting this editor cannot preserve. Edit it in Vikunja.
            Saving other fields keeps the original description unchanged.
          </p>
        </>
      ) : activated ? (
        <Suspense fallback={<EditorLoading media={false} />}>
          <Editor
            initialHtml={initialHtml}
            label="Description"
            disabled={disabled}
            onChange={setHtml}
          />
        </Suspense>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Media uploads are available in the task discussion after creation.
      </p>
    </details>
  );
}
