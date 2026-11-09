import { Check, Share2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Shares only a same-origin link; it never changes access or exports task content. */
export function ShareButton({
  path,
  label = "Share",
  iconOnly = false,
}: {
  path: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const busy = useRef(false);
  const [notice, setNotice] = useState("");
  const [manualURL, setManualURL] = useState("");

  async function share() {
    if (busy.current) return;
    busy.current = true;
    setNotice("");
    const url = new URL(path, window.location.origin).href;
    try {
      if (await nativeShare(url)) return;
      await navigator.clipboard.writeText(url);
      setNotice("Link copied.");
    } catch {
      setManualURL(url);
    } finally {
      busy.current = false;
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={iconOnly ? "icon" : "sm"}
        className="min-h-11 min-w-11 shrink-0"
        aria-label={label}
        title={label}
        onClick={() => void share()}
      >
        {notice ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
        {!iconOnly ? "Share" : null}
      </Button>
      <span role="status" className="sr-only">
        {notice}
      </span>
      <Dialog
        open={Boolean(manualURL)}
        onOpenChange={(open) => {
          if (!open) setManualURL("");
        }}
      >
        <DialogContent>
          <DialogTitle>Copy link</DialogTitle>
          <DialogDescription>
            Automatic sharing is unavailable. Select and copy this link. Access stays unchanged.
          </DialogDescription>
          <Input
            aria-label="Link to share"
            readOnly
            value={manualURL}
            onFocus={(event) => event.currentTarget.select()}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

async function nativeShare(url: string): Promise<boolean> {
  if (!navigator.share || (navigator.canShare && !navigator.canShare({ url }))) return false;
  try {
    await navigator.share({ url });
    return true;
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError";
  }
}
