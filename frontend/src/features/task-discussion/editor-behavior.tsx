import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_CRITICAL, PASTE_COMMAND } from "lexical";
import { useEffect } from "react";
import { $pasteClipboard } from "./editor-clipboard";

export function EditorBehavior({
  disabled,
  focusOnMount,
  onPasteNotice,
}: {
  disabled: boolean;
  focusOnMount: boolean;
  onPasteNotice: (notice: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (focusOnMount) editor.focus();
  }, [editor, focusOnMount]);
  useEffect(() => {
    editor.setEditable(!disabled);
  }, [editor, disabled]);
  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (!(event instanceof ClipboardEvent) || !event.clipboardData) return false;
          if (event.clipboardData.files.length) return false;
          event.preventDefault();
          $pasteClipboard(editor, event.clipboardData, onPasteNotice);
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    [editor, onPasteNotice],
  );
  return null;
}
