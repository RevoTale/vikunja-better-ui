import { useMutation } from "@apollo/client/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $insertNodes,
  COMMAND_PRIORITY_CRITICAL,
  DROP_COMMAND,
  PASTE_COMMAND,
} from "lexical";
import { PaperclipIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type DiscussionAttachmentFragment,
  UploadDiscussionMediaDocument,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { AttachmentPicker } from "./attachment-picker";
import type { MediaData } from "./media-html";
import { $createMediaNode, MediaNode } from "./media-node";
import { mediaKind } from "./media-reference";

export function EditorMedia({
  taskId,
  csrfToken,
  onBusyChange,
}: {
  taskId: string;
  csrfToken: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const fileInputId = useId();
  const [upload] = useMutation(UploadDiscussionMediaDocument);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [showAttachments, setShowAttachments] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const insert = useCallback(
    (data: MediaData) =>
      new Promise<string>((resolve) => {
        editor.update(() => {
          if (!$getSelection()) $getRoot().selectEnd();
          const node = $createMediaNode(data);
          $insertNodes([node]);
          const paragraph = $createParagraphNode();
          node.insertAfter(paragraph);
          paragraph.select();
          resolve(node.getKey());
        });
      }),
    [editor],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      if (inFlight.current || uncertain || !editor.isEditable()) return;
      const kind = mediaKind(file.type);
      if (!kind || file.size === 0 || file.size > 20 * 1024 * 1024) {
        setMessage(
          "Choose a supported image, audio or video file, up to 20 MiB. SVG and embedded webpages are not supported.",
        );
        return;
      }
      inFlight.current = true;
      setBusy(true);
      onBusyChange(true);
      setMessage("");
      const nodeKey = await insert({ source: "", kind, name: file.name, alt: "" });
      try {
        const result = await upload({ variables: { input: { taskId, csrfToken, file } } });
        const attachment = result.data?.uploadTaskMedia;
        if (!attachment) throw new Error("Missing upload confirmation");
        if (!mounted.current) return;
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          // Never restore a removed placeholder or replace the whole document.
          if (node instanceof MediaNode && node.isAttached())
            node.setMedia({ ...node.getMedia(), source: attachment.sourceUrl });
        });
        setMessage(
          `${file.name} uploaded. It remains a task attachment if you abandon this draft.`,
        );
      } catch (error) {
        if (!mounted.current) return;
        editor.update(() => $getNodeByKey(nodeKey)?.remove());
        setMessage(
          graphQLErrorMessage(
            error,
            "Upload could not be confirmed. Check task attachments before trying again; the file may already be stored.",
          ),
        );
        setUncertain(true);
      } finally {
        inFlight.current = false;
        if (mounted.current) {
          setBusy(false);
          onBusyChange(false);
        }
      }
    },
    [csrfToken, editor, insert, onBusyChange, taskId, uncertain, upload],
  );

  useEffect(() => {
    const paste = editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent) || !event.clipboardData?.files.length) return false;
        event.preventDefault();
        const file = event.clipboardData.files[0];
        if (file) void uploadFile(file);
        if (event.clipboardData.files.length > 1)
          setMessage("Insert one file at a time; only the first pasted file is uploaded.");
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
    const drop = editor.registerCommand(
      DROP_COMMAND,
      (event) => {
        const file = event.dataTransfer?.files[0];
        if (!file) return false;
        event.preventDefault();
        void uploadFile(file);
        if ((event.dataTransfer?.files.length ?? 0) > 1)
          setMessage("Insert one file at a time; only the first dropped file is uploaded.");
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
    return () => {
      paste();
      drop();
    };
  }, [editor, uploadFile]);

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
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            setUncertain(false);
            setMessage("");
          }}
        >
          I checked attachments; allow another upload
        </Button>
      ) : null}
    </div>
  );
}
