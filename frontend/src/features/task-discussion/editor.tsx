import { $generateHtmlFromNodes } from "@lexical/html";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useState } from "react";
import { EditorBehavior } from "./editor-behavior";
import { createDiscussionExtension } from "./editor-extension";
import { EditorMarkdown } from "./editor-markdown";
import { EditorMedia } from "./editor-media";
import { EditorToolbar } from "./editor-toolbar";
import { cleanComment } from "./html";

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
  taskId: string;
  csrfToken: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const [pasteNotice, setPasteNotice] = useState("");
  // Initial content is consumed once. Only an explicit reset/restore remounts this editor.
  const [extension] = useState(() => createDiscussionExtension(initialHtml));
  return (
    <LexicalExtensionComposer extension={extension} contentEditable={null}>
      <fieldset disabled={disabled} className="min-w-0 rounded-lg border bg-background">
        <legend className="sr-only">{label} editor</legend>
        <EditorToolbar />
        <EditorMedia taskId={taskId} csrfToken={csrfToken} onBusyChange={onBusyChange} />
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
        disabled={disabled}
        focusOnMount={focusOnMount}
        onPasteNotice={setPasteNotice}
      />
      <HorizontalRulePlugin />
      <EditorMarkdown />
      <OnChangePlugin
        ignoreSelectionChange
        onChange={(_, editor) => {
          editor.read(() => onChange(cleanComment($generateHtmlFromNodes(editor))));
        }}
      />
    </LexicalExtensionComposer>
  );
}
