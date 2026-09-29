import { PaperclipIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DiscussionAttachmentFragment } from "@/graphql/graphql";
import { AttachmentPicker } from "./attachment-picker";
import { mediaKind } from "./media-reference";
import { useMediaClipboard } from "./use-media-clipboard";
import { useMediaUpload } from "./use-media-upload";

export function EditorMedia({
  taskId,
  csrfToken,
  onBusyChange,
}: {
  taskId: string;
  csrfToken: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const fileInputId = useId();
  const [showAttachments, setShowAttachments] = useState(false);
  const { editor, insert, uploadFile, busy, uncertain, message, setMessage, allowRetry } =
    useMediaUpload(taskId, csrfToken, onBusyChange);
  useMediaClipboard(editor, uploadFile, setMessage);
  function useAttachment(attachment: DiscussionAttachmentFragment) {
    const kind = mediaKind(attachment.mimeType);
    if (kind) void insert({ source: attachment.sourceUrl, kind, name: attachment.name, alt: "" });
  }

  return (
    <div className="space-y-2 border-b p-2">
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-2 focus-visible:ring-2 focus-visible:ring-ring">
          <PaperclipIcon aria-hidden="true" className="size-4" />
          Media and attachments
        </summary>
        <div className="space-y-2">
          <label className="block text-sm" htmlFor={fileInputId}>
            Upload media
            <Input
              id={fileInputId}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/mp4,audio/webm,video/mp4,video/webm,video/ogg"
              disabled={busy || uncertain}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadFile(file);
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            One file at a time, up to 20 MiB. Paste or drop images, audio or video. Uploaded files
            stay in the task even if you abandon the draft.
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            aria-expanded={showAttachments}
            onClick={() => setShowAttachments(!showAttachments)}
          >
            <PaperclipIcon aria-hidden="true" className="size-4" />
            {showAttachments ? "Hide attachments" : "Choose task attachment"}
          </Button>
          {showAttachments ? <AttachmentPicker taskId={taskId} onSelect={useAttachment} /> : null}
        </div>
      </details>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      {uncertain ? (
        <Button type="button" variant="outline" className="min-h-11" onClick={allowRetry}>
          I checked attachments; allow another upload
        </Button>
      ) : null}
    </div>
  );
}
