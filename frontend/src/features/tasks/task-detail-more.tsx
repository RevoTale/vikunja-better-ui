import { Menu } from "@base-ui/react/menu";
import { Link } from "@tanstack/react-router";
import { Bug, Ellipsis, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const itemClass =
  "flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm outline-none data-highlighted:bg-accent data-disabled:opacity-50 [&_svg]:size-4";

export function TaskDetailMore({
  taskId,
  returnTo,
  canDelete,
  pending,
}: {
  taskId: string;
  returnTo: string;
  canDelete: boolean;
  pending: boolean;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="More task actions"
            disabled={pending}
          />
        }
      >
        <Ellipsis aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4} className="z-50">
          <Menu.Popup className="min-w-52 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            <Menu.Item
              className={itemClass}
              render={
                <Link to="/tasks/$taskId/extended" params={{ taskId }} search={{ returnTo }} />
              }
            >
              <Bug aria-hidden="true" /> Extended
            </Menu.Item>
            {canDelete ? (
              <>
                <Menu.Separator className="my-1 h-px bg-border" />
                <Menu.Item
                  className={`${itemClass} text-destructive`}
                  render={
                    <Link to="/tasks/$taskId/delete" params={{ taskId }} search={{ returnTo }} />
                  }
                >
                  <Trash2 aria-hidden="true" /> Delete
                </Menu.Item>
              </>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
