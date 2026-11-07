import { CircleHelp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import type { Row } from "./edit-storage-rows";

export function StoragePreview({
  readRows,
  timezone,
  disabled,
}: {
  readRows: (form: HTMLFormElement) => Row[];
  timezone: string;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState<Row[] | null>(null);
  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="outline" disabled={disabled} />}
        onClick={(event) => {
          const form = event.currentTarget.closest("form");
          if (form) setDraft(readRows(form));
        }}
      >
        Preview Vikunja fields
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>Vikunja field preview</DialogTitle>
        <DialogDescription>
          Current draft · {timezone}. Select a question mark to see how a value was chosen.
        </DialogDescription>
        <dl className="divide-y">
          {draft?.map(([field, value, why]) => (
            <div key={field} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <dt className="font-mono text-xs text-muted-foreground">{field}</dt>
                <dd className="mt-1 whitespace-pre-wrap wrap-anywhere">{value || "Not set"}</dd>
              </div>
              <Popover>
                <PopoverTrigger
                  type="button"
                  aria-label={`Why ${field}?`}
                  className="inline-grid size-9 shrink-0 place-items-center rounded-md hover:bg-muted focus-visible:outline-2"
                >
                  <CircleHelp className="size-4" aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent className="max-w-[calc(100vw-2rem)]">
                  <PopoverTitle>{field}</PopoverTitle>
                  <p>{why}</p>
                </PopoverContent>
              </Popover>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
