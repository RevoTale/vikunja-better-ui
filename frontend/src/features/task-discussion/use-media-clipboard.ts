import {
  COMMAND_PRIORITY_CRITICAL,
  DROP_COMMAND,
  type LexicalEditor,
  PASTE_COMMAND,
} from "lexical";
import { useEffect } from "react";
export function useMediaClipboard(
  editor: LexicalEditor,
  uploadFile: (file: File) => Promise<void>,
  setMessage: (message: string) => void,
) {
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
  }, [editor, uploadFile, setMessage]);
}
