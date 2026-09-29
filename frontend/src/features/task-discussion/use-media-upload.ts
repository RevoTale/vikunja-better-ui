import { useMutation } from "@apollo/client/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $insertNodes,
  type LexicalEditor,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadDiscussionMediaDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import type { MediaData } from "./media-html";
import { $createMediaNode, MediaNode } from "./media-node";
import { mediaKind } from "./media-reference";

export function useMediaUpload(
  taskId: string,
  csrfToken: string,
  onBusyChange: (busy: boolean) => void,
) {
  const [editor] = useLexicalComposerContext();
  const insert = useMediaInsertion(editor);
  const [upload] = useMutation(UploadDiscussionMediaDocument);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const finishUpload = useCallback(() => {
    inFlight.current = false;
    if (!mounted.current) return;
    setBusy(false);
    onBusyChange(false);
  }, [onBusyChange]);

  const uploadSource = useCallback(
    async (file: File) => {
      const result = await upload({ variables: { input: { taskId, csrfToken, file } } });
      const attachment = result.data?.uploadTaskMedia;
      if (!attachment) throw new Error("Missing upload confirmation");
      return attachment.sourceUrl;
    },
    [csrfToken, taskId, upload],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      if (inFlight.current || uncertain || !editor.isEditable()) return;
      const kind = mediaKind(file.type);
      if (!kind || !validUploadSize(file)) {
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
        const source = await uploadSource(file);
        if (!mounted.current) return;
        editor.update(() => $confirmUpload(nodeKey, source));
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
        finishUpload();
      }
    },
    [editor, insert, onBusyChange, uncertain, uploadSource, finishUpload],
  );

  return {
    editor,
    insert,
    uploadFile,
    busy,
    uncertain,
    message,
    setMessage,
    allowRetry() {
      setUncertain(false);
      setMessage("");
    },
  };
}

function useMediaInsertion(editor: LexicalEditor) {
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

  return insert;
}

function validUploadSize(file: File): boolean {
  return file.size > 0 && file.size <= 20 * 1024 * 1024;
}

function $confirmUpload(nodeKey: string, source: string) {
  const node = $getNodeByKey(nodeKey);
  // Never restore a removed placeholder or replace the whole document.
  if (node instanceof MediaNode && node.isAttached()) node.setMedia({ ...node.getMedia(), source });
}
