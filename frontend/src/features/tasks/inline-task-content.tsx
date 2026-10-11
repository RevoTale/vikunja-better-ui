import { Pencil } from "lucide-react";
import { type KeyboardEvent, lazy, Suspense, useCallback, useEffect, useRef } from "react";
import { EditorLoading } from "@/features/task-discussion/discussion-loading";
import { hasUnsupportedContent } from "@/features/task-discussion/html";
import { InlineEditorActions } from "./inline-editor-actions";
import type { InlineTask, InlineTaskField } from "./inline-task-input";
import { TaskDescription } from "./task-description";
import type { InlineTaskEditing } from "./use-inline-task-editing";

const Editor = lazy(() =>
  import("@/features/task-discussion/editor").then((module) => ({
    default: module.DiscussionEditor,
  })),
);
const titleClass =
  "w-full text-left text-2xl font-semibold tracking-tight wrap-anywhere sm:text-3xl";

export function InlineTaskContent({
  task,
  editor,
}: {
  task: InlineTask;
  editor: InlineTaskEditing;
}) {
  const disabled = task.isDone || editor.pending || editor.blocked || editor.active !== null;
  const unsupported = hasUnsupportedContent(task.description);
  const { focusTitle, titleTrigger, descriptionTrigger } = useContentFocus(editor.active);
  return (
    <>
      {editor.active === "title" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void editor.save();
          }}
        >
          <textarea
            aria-label="Task title"
            ref={focusTitle}
            required
            maxLength={250}
            rows={1}
            disabled={editor.pending}
            className={`${titleClass} [field-sizing:content] resize-none rounded-sm bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            value={editor.input.title}
            onChange={(event) => {
              const title = event.currentTarget.value;
              editor.setInput((input) => ({ ...input, title }));
            }}
            onKeyDown={(event) => titleKey(event, editor)}
          />
          <InlineEditorActions editor={editor} />
        </form>
      ) : (
        <h1 className={titleClass} aria-label={task.title}>
          {task.isDone ? (
            task.title
          ) : (
            <button
              ref={titleTrigger}
              type="button"
              className="group flex w-full items-start gap-2 rounded-sm text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`Edit title: ${task.title}`}
              disabled={disabled}
              onClick={() => editor.open("title")}
            >
              <span className="min-w-0 flex-1">{task.title}</span>
              <Pencil
                aria-hidden="true"
                className="mt-2 size-4 shrink-0 text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100"
              />
            </button>
          )}
        </h1>
      )}
      <div className="min-w-0 max-w-prose space-y-2 pt-3 pb-2">
        <div className="flex min-h-11 items-center justify-between gap-2">
          <h2 className="text-xs font-medium text-muted-foreground">Description</h2>
          {!task.isDone && !unsupported && editor.active !== "description" ? (
            <button
              ref={descriptionTrigger}
              type="button"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              aria-label="Edit description"
              disabled={disabled}
              onClick={() => editor.open("description")}
            >
              <Pencil aria-hidden="true" className="size-3.5" /> Edit
            </button>
          ) : null}
        </div>
        {editor.active === "description" ? (
          <form
            className="min-w-0 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void editor.save();
            }}
          >
            <Suspense fallback={<EditorLoading media={false} />}>
              <div className="min-w-0">
                <Editor
                  initialHtml={editor.input.description}
                  label="Task description"
                  disabled={editor.pending}
                  compact
                  focusOnMount
                  onChange={(description) =>
                    editor.setInput((input) => ({ ...input, description }))
                  }
                />
              </div>
              <InlineEditorActions editor={editor} />
            </Suspense>
          </form>
        ) : (
          <div className="min-h-12 min-w-0">
            <TaskDescription description={task.description} compact />
            {unsupported && !task.isDone ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Edit this description in Vikunja to preserve its unsupported formatting.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

function useContentFocus(active: InlineTaskField | null) {
  const focusTitle = useCallback((node: HTMLTextAreaElement | null) => node?.focus(), []);
  const titleTrigger = useRef<HTMLButtonElement>(null);
  const descriptionTrigger = useRef<HTMLButtonElement>(null);
  const previousField = useRef(active);
  useEffect(() => {
    if (active === null) {
      if (previousField.current === "title") titleTrigger.current?.focus();
      if (previousField.current === "description") descriptionTrigger.current?.focus();
    }
    previousField.current = active;
  }, [active]);
  return { focusTitle, titleTrigger, descriptionTrigger };
}

function titleKey(event: KeyboardEvent<HTMLTextAreaElement>, editor: InlineTaskEditing) {
  if (event.nativeEvent.isComposing) return;
  if (event.key === "Escape") {
    event.preventDefault();
    editor.cancel();
  }
  if (event.key === "Enter") {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}
