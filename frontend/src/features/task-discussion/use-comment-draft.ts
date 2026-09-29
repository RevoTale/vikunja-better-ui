import { useEffect, useRef, useState } from "react";
import { draftKey, draftStorage, loadDraft, saveDraft } from "./draft";
import { cleanComment, hasCommentContent, splitReply } from "./html";

export function useCommentDraft({
  taskId,
  authorId,
  commentId,
  initialHtml = "",
  reply,
}: {
  taskId: string;
  authorId: string;
  commentId: string | undefined;
  initialHtml: string;
  reply: { quote: string } | null | undefined;
}) {
  const key = draftKey(taskId, authorId, commentId);
  const [recovered, setRecovered] = useState(() => loadDraft(draftStorage(), key));
  const [content, setContent] = useState(() => splitReply(initialHtml));
  const [editorInitial, setEditorInitial] = useState(content.body);
  const [epoch, setEpoch] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [stored, setStored] = useState(true);
  const root = useRef<HTMLElement>(null);
  const bodyHtml = cleanComment(content.quote + content.body);

  useEffect(() => {
    if (!reply) return;
    setContent((previous) => ({ ...previous, quote: reply.quote }));
    setDirty(true);
    root.current?.querySelector<HTMLElement>("[contenteditable=true]")?.focus();
  }, [reply]);

  useEffect(() => {
    if (dirty)
      setStored(saveDraft(draftStorage(), key, hasCommentContent(bodyHtml) ? bodyHtml : ""));
  }, [bodyHtml, dirty, key]);

  function reset(html: string) {
    const next = splitReply(html);
    setContent(next);
    setEditorInitial(next.body);
    setEpoch((value) => value + 1);
  }

  return {
    root,
    recovered,
    content,
    editorInitial,
    epoch,
    dirty,
    stored,
    bodyHtml,
    restore() {
      reset(recovered);
      setDirty(true);
      setRecovered("");
    },
    dismiss() {
      if (!dirty && !saveDraft(draftStorage(), key, "")) return false;
      setRecovered("");
      return true;
    },
    clear() {
      saveDraft(draftStorage(), key, "");
      setDirty(false);
      setRecovered("");
      reset("");
    },
    cancelReply() {
      setContent((previous) => ({ ...previous, quote: "" }));
      setDirty(true);
    },
    changeBody(body: string) {
      setContent((previous) => ({ ...previous, body }));
      setDirty(true);
    },
  };
}
