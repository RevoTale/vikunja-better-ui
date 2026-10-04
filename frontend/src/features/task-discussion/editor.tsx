import { useApolloClient } from "@apollo/client/react";
import { $generateHtmlFromNodes } from "@lexical/html";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useState } from "react";
import { DiscussionTaskLinkDocument } from "@/graphql/graphql";
import { EditorBehavior } from "./editor-behavior";
import { EditorEmojiShortcodes } from "./editor-emoji-shortcodes";
import { createDiscussionExtension } from "./editor-extension";
import { EditorMarkdown } from "./editor-markdown";
import { EditorMedia } from "./editor-media";
import { EditorToolbar } from "./editor-toolbar";
import { cleanComment } from "./html";
import "./discussion.css";

export function DiscussionEditor({
  initialHtml,
  label,
  disabled,
  onChange,
  focusOnMount = false,
  taskId,
  csrfToken,
  onBusyChange,
}: {
  initialHtml: string;
  label: string;
  disabled: boolean;
  onChange: (html: string) => void;
  focusOnMount?: boolean;
  taskId?: string;
  csrfToken?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [pasteNotice, setPasteNotice] = useState("");
  const client = useApolloClient();
  // Initial content is consumed once. Only an explicit reset/restore remounts this editor.
  const [extension] = useState(() =>
    createDiscussionExtension(initialHtml, {
      origin: window.location.origin,
      resolveTitle: async (id) => {
        const result = await client.query({
          query: DiscussionTaskLinkDocument,
          variables: { id },
          fetchPolicy: "network-only",
        });
        return result.data?.task?.title ?? null;
      },
    }),
  );
  return (
    <LexicalExtensionComposer extension={extension} contentEditable={null}>
      <fieldset disabled={disabled} className="min-w-0 rounded-lg border bg-background">
        <legend className="sr-only">{label} editor</legend>
        <EditorToolbar />
        {taskId && csrfToken && onBusyChange ? (
          <EditorMedia taskId={taskId} csrfToken={csrfToken} onBusyChange={onBusyChange} />
        ) : null}
        {pasteNotice ? (
          <p role="status" className="p-2 text-sm">
            {pasteNotice}
          </p>
        ) : null}
        <ContentEditable
          aria-label={label}
          aria-multiline
          className="discussion-rich-text min-h-32 rounded-b-lg p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </fieldset>
      <EditorBehavior
        mediaEnabled={Boolean(taskId && csrfToken && onBusyChange)}
        disabled={disabled}
        focusOnMount={focusOnMount}
        onPasteNotice={setPasteNotice}
      />
      <HorizontalRulePlugin />
      <EditorMarkdown />
      <EditorEmojiShortcodes />
      <OnChangePlugin
        ignoreSelectionChange
        onChange={(_, editor, tags) => {
          if (tags.has("vbu:initial-content")) return;
          editor.read(() => onChange(cleanComment($generateHtmlFromNodes(editor))));
        }}
      />
    </LexicalExtensionComposer>
  );
}
