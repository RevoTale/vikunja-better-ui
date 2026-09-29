import { Menu } from "@base-ui/react/menu";
import { Check, Copy, Ellipsis, Link, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { commentMarkdown } from "./comment-markdown";

const itemClass =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm outline-none data-highlighted:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:size-4";

export function CommentMenu({
  taskId,
  commentId,
  html,
  own,
  unsupported,
  onEdit,
  onDelete,
}: {
  taskId: string;
  commentId: string;
  html: string;
  own: boolean;
  unsupported: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
      setNotice("");
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  async function copy(markdown: boolean) {
    if (busy.current) return;
    busy.current = true;
    setCopied(false);
    try {
      const value = markdown
        ? commentMarkdown(html)
        : new URL(`/tasks/${taskId}/discussion?comment=${commentId}`, window.location.origin).href;
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setNotice(markdown ? "Comment copied as Markdown." : "Comment link copied.");
    } catch {
      setNotice("Copy unavailable. Check clipboard permissions and try again.");
    } finally {
      busy.current = false;
    }
  }
  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label="Comment actions"
            />
          }
        >
          {copied ? (
            <Check aria-hidden="true" className="text-emerald-700 dark:text-emerald-300" />
          ) : (
            <Ellipsis aria-hidden="true" />
          )}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={4} className="z-50">
            <Menu.Popup className="min-w-56 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-1 text-popover-foreground shadow-md outline-none">
              {own ? (
                <Menu.Item className={itemClass} disabled={unsupported} onClick={onEdit}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Menu.Item>
              ) : null}
              <Menu.Item className={itemClass} onClick={() => copy(false)}>
                <Link aria-hidden="true" />
                Copy link to comment
              </Menu.Item>
              <Menu.Item className={itemClass} disabled={unsupported} onClick={() => copy(true)}>
                <Copy aria-hidden="true" />
                Copy content as Markdown
              </Menu.Item>
              {own ? (
                <>
                  <Menu.Separator className="my-1 h-px bg-border" />
                  <Menu.Item className={`${itemClass} text-destructive`} onClick={onDelete}>
                    <Trash2 aria-hidden="true" />
                    Delete
                  </Menu.Item>
                </>
              ) : null}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <span
        role="status"
        className={notice && !copied ? "w-full text-xs text-destructive" : "sr-only"}
      >
        {notice}
      </span>
    </>
  );
}
