import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_CRITICAL, DROP_COMMAND, mergeRegister, PASTE_COMMAND } from "lexical";
import { useEffect } from "react";
import { $pasteClipboard } from "./editor-clipboard";

export function EditorBehavior({
  disabled,
  focusOnMount,
  onPasteNotice,
  mediaEnabled,
}: {
  disabled: boolean;
  focusOnMount: boolean;
  onPasteNotice: (notice: string) => void;
  mediaEnabled: boolean;
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
      mergeRegister(
        editor.registerCommand(
          PASTE_COMMAND,
          (event) => {
            if (!(event instanceof ClipboardEvent) || !event.clipboardData) return false;
            if (event.clipboardData.files.length) {
              if (mediaEnabled) return false;
              event.preventDefault();
              onPasteNotice("Upload media in the task discussion after creation.");
              return true;
            }
            event.preventDefault();
            $pasteClipboard(editor, event.clipboardData, onPasteNotice);
            return true;
          },
          COMMAND_PRIORITY_CRITICAL,
        ),
        editor.registerCommand(
          DROP_COMMAND,
          (event) => {
            if (mediaEnabled || !event.dataTransfer?.files.length) return false;
            event.preventDefault();
            onPasteNotice("Upload media in the task discussion after creation.");
            return true;
          },
          COMMAND_PRIORITY_CRITICAL,
        ),
      ),
    [editor, onPasteNotice, mediaEnabled],
  );
  return null;
}
