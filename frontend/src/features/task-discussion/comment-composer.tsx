import { SaveIcon, SendIcon, XIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommentBody } from "./comment-body";
import { EditorLoading } from "./discussion-loading";
import { DraftRecovery } from "./draft-recovery";
import { hasCommentContent, maxCommentBytes } from "./html";
import { useCommentDraft } from "./use-comment-draft";
import { useCommentSave } from "./use-comment-save";

const DiscussionEditor = lazy(() =>
  import("./editor").then((module) => ({ default: module.DiscussionEditor })),
);

export function CommentComposer({
  taskId,
  authorId,
  csrfToken,
  commentId,
  initialHtml = "",
  reply,
  onSaved,
  onCancel,
}: {
  taskId: string;
  authorId: string;
  csrfToken: string;
  commentId?: string;
  initialHtml?: string;
  reply?: { quote: string } | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const draft = useCommentDraft({ taskId, authorId, commentId, initialHtml, reply });
  const { root, recovered, content, editorInitial, epoch, dirty, stored, bodyHtml } = draft;
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const { save, error, uncertain, pending, allowRetry } = useCommentSave();
  const tooLong = new TextEncoder().encode(bodyHtml).length > maxCommentBytes;
  const SubmitIcon = commentId ? SaveIcon : SendIcon;
  const submitLabel = commentId ? "Save comment" : "Post comment";

  async function submit() {
    if (uploading || tooLong || !hasCommentContent(content.body)) return;
    setNotice("");
    if (await save({ csrfToken, taskId, bodyHtml }, commentId)) {
      draft.clear();
      setNotice(commentId ? "Comment updated." : "Comment posted.");
      onSaved();
    }
  }

  return (
    <section
      ref={root}
      className="space-y-2"
      aria-label={commentId ? "Edit comment form" : "New comment form"}
    >
      {recovered ? (
        <DraftRecovery
          dirty={dirty}
          disabled={pending || uploading}
          onRestore={() => {
            draft.restore();
            setNotice("Draft restored from this browser.");
          }}
          onDismiss={draft.dismiss}
        />
      ) : null}
      {content.quote ? (
        <div className="rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">Replying to</p>
          <CommentBody html={content.quote} />
          <Button
            variant="ghost"
            className="min-h-11"
            disabled={pending}
            onClick={draft.cancelReply}
          >
            <XIcon aria-hidden="true" className="size-4" />
            Cancel reply
          </Button>
        </div>
      ) : null}
      <Suspense fallback={<EditorLoading />}>
        <DiscussionEditor
          key={epoch}
          taskId={taskId}
          csrfToken={csrfToken}
          onBusyChange={setUploading}
          initialHtml={editorInitial}
          label={commentId ? "Edit comment" : "Comment"}
          disabled={pending}
          focusOnMount={Boolean(commentId) || epoch > 0}
          onChange={draft.changeBody}
        />
      </Suspense>
      <CommentSaveFeedback
        tooLong={tooLong}
        bodyHtml={bodyHtml}
        stored={stored}
        error={error}
        uncertain={uncertain}
        allowRetry={allowRetry}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          disabled={
            pending || uploading || uncertain || tooLong || !hasCommentContent(content.body)
          }
          onClick={submit}
        >
          <SubmitIcon aria-hidden="true" className="size-4" />
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="outline" className="min-h-11" disabled={pending} onClick={onCancel}>
            <XIcon aria-hidden="true" className="size-4" />
            Cancel edit
          </Button>
        ) : null}
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {notice || (dirty && stored ? "Draft saved in this browser." : "")}
      </p>
    </section>
  );
}

function CommentSaveFeedback({
  tooLong,
  bodyHtml,
  stored,
  error,
  uncertain,
  allowRetry,
}: {
  tooLong: boolean;
  bodyHtml: string;
  stored: boolean;
  error: string;
  uncertain: boolean;
  allowRetry: () => void;
}) {
  return (
    <>
      {tooLong ? (
        <p role="alert" className="text-sm text-destructive">
          Comment exceeds the 100 KB limit.
        </p>
      ) : null}
      {/<(?:mark|sub|sup)\b|data-media-kind=/.test(bodyHtml) ? (
        <p className="text-xs text-muted-foreground">
          Native Vikunja 2.5 displays highlight, subscript and superscript as ordinary text and
          removes that formatting on save. Audio/video remain attachment links there; edit these
          formats here to keep them.
        </p>
      ) : null}
      {!stored ? (
        <p role="status" className="text-sm text-muted-foreground">
          Local draft could not be saved. Keep this page open until you post.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {uncertain ? (
        <div className="space-y-2 text-sm">
          <p>Use Refresh above and check whether the comment was saved before retrying.</p>
          <Button variant="outline" className="min-h-11" onClick={allowRetry}>
            I checked; allow retry
          </Button>
        </div>
      ) : null}
    </>
  );
}
