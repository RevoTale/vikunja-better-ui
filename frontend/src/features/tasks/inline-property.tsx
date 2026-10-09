import { lazy, type ReactNode, Suspense, useState } from "react";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import type { RecurrenceMode, RecurrenceUnit } from "@/graphql/graphql";
import { InlineEditorActions, InlineEditorFeedback } from "./inline-editor-actions";
import type { InlineTask, InlineTaskField } from "./inline-task-input";
import type { InlineTaskEditing } from "./use-inline-task-editing";

const Fields = lazy(() =>
  import("./inline-property-fields").then((module) => ({ default: module.InlinePropertyFields })),
);

export function InlineProperty({
  field,
  label,
  task,
  editor,
  children,
}: {
  field: InlineTaskField;
  label: string;
  task: InlineTask;
  editor: InlineTaskEditing;
  children: ReactNode;
}) {
  const [labelsPending, setLabelsPending] = useState(false);
  if (task.isDone) return children;
  const open = editor.active === field;
  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (editor.pending || labelsPending) {
          details.cancel();
          return;
        }
        if (next) editor.open(field);
        else editor.cancel();
      }}
    >
      <PopoverTrigger
        aria-label={`Edit ${label.toLowerCase()}`}
        disabled={editor.pending || editor.blocked || (editor.active !== null && !open)}
        className="-mx-1 max-w-full rounded-sm px-1 text-left hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[min(80dvh,40rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto p-4"
      >
        <PopoverTitle>Edit {label.toLowerCase()}</PopoverTitle>
        {open ? (
          <form
            className="grid min-w-0 gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (labelsPending) return;
              const form = new FormData(event.currentTarget);
              const input = { ...editor.input };
              if (field === "labels") input.labelIds = form.getAll("labelIds").map(String);
              if (field === "type" && input.recurrence)
                input.recurrence = {
                  interval: Number(form.get("interval")),
                  unit: String(form.get("unit")) as RecurrenceUnit,
                  mode: String(form.get("mode")) as RecurrenceMode,
                  keepDueTime: form.get("keepDueTime") === "on",
                };
              void editor.save(input);
            }}
          >
            <Suspense fallback={<LoadingPlaceholder className="h-32 w-full" />}>
              <fieldset disabled={editor.pending} className="grid min-w-0 gap-3">
                <legend className="sr-only">{label} fields</legend>
                <Fields
                  field={field}
                  task={task}
                  editor={editor}
                  onLabelsPending={setLabelsPending}
                />
              </fieldset>
              <InlineEditorActions editor={editor} disabled={labelsPending} />
            </Suspense>
            <InlineEditorFeedback editor={editor} />
          </form>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
