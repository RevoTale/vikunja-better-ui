import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { CheckIcon, UnlinkIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeLink } from "./html";
import type { EditorAction } from "./use-editor-toolbar";

export function EditorLinkTools({
  initialUrl,
  canApply,
  run,
  onClose,
}: {
  initialUrl: string;
  canApply: boolean;
  run: EditorAction;
  onClose: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [url, setUrl] = useState(initialUrl);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const applyLink = (value: string | null) => {
    run(() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, value));
    onClose();
  };
  return (
    <div className="flex flex-wrap items-center gap-2 p-2">
      <Input
        ref={input}
        aria-label="Link URL"
        value={url}
        placeholder="https://…"
        onChange={(event) => setUrl(event.target.value)}
      />
      <Button
        type="button"
        className="min-h-11"
        disabled={!canApply || !safeLink(url)}
        onClick={() => applyLink(url)}
      >
        <CheckIcon aria-hidden="true" className="size-4" />
        Apply link
      </Button>
      <Button
        type="button"
        className="min-h-11"
        variant="outline"
        disabled={!initialUrl}
        onClick={() => applyLink(null)}
      >
        <UnlinkIcon aria-hidden="true" className="size-4" />
        Remove link
      </Button>
      <Button
        type="button"
        className="min-h-11"
        variant="ghost"
        onClick={() => {
          onClose();
          editor.focus();
        }}
      >
        <XIcon aria-hidden="true" className="size-4" /> Cancel link
      </Button>
      <p className="text-xs text-muted-foreground">
        Select text first. HTTP, HTTPS and email links only.
      </p>
    </div>
  );
}
