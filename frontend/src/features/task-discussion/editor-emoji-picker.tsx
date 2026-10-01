import { $getSelection, $isRangeSelection } from "lexical";
import { Smile } from "lucide-react";
import { useState } from "react";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { findEmoji } from "./emoji-data";
import type { EditorAction } from "./use-editor-toolbar";
import { useEmojiData } from "./use-emoji-data";

export function EditorEmojiPicker({ run, disabled }: { run: EditorAction; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { choices, error } = useEmojiData(open);
  const matches = findEmoji(choices, search);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 min-w-11"
        aria-label="Insert emoji"
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen(true)}
      >
        <Smile aria-hidden="true" className="size-4" />
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Insert emoji</DialogTitle>
        <DialogDescription>
          Search names or shortcodes. Skin tones are separate choices.
        </DialogDescription>
        <Input
          aria-label="Find emoji"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {error ? <p role="alert">Emoji could not be loaded. Close and reopen to retry.</p> : null}
        <div className="grid h-64 grid-cols-5 content-start gap-1 overflow-auto sm:grid-cols-7">
          {!error && choices.length === 0 ? (
            <>
              <span role="status" className="sr-only">
                Loading emoji
              </span>
              <LoadingPlaceholder className="col-span-full h-64" />
            </>
          ) : null}
          {matches.map((choice) => (
            <Button
              key={choice.unicode}
              type="button"
              variant="ghost"
              className="size-11 text-2xl"
              title={choice.label}
              aria-label={choice.label}
              onClick={() => {
                setOpen(false);
                run(() => {
                  const selection = $getSelection();
                  if ($isRangeSelection(selection)) selection.insertText(choice.unicode);
                });
              }}
            >
              {choice.unicode}
            </Button>
          ))}
        </div>
        {choices.length > 0 && matches.length === 0 ? <p>No matching emoji.</p> : null}
      </DialogContent>
    </Dialog>
  );
}
