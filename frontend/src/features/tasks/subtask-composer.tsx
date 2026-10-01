import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type SubtaskParent, SubtaskProperties } from "./subtask-properties";
import { useSubtaskCreate } from "./use-subtask-create";
import { useTaskRelations } from "./use-task-relations";

export function NewSubtask({ parent }: { parent: SubtaskParent }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <SubtaskComposer parent={parent} onClose={() => setOpen(false)} />
  ) : (
    <Button variant="outline" onClick={() => setOpen(true)}>
      New subtask
    </Button>
  );
}

export function SubtaskComposer({
  parent,
  onClose,
}: {
  parent: SubtaskParent;
  onClose: () => void;
}) {
  const state = useSubtaskCreate(parent.id);
  const relations = useTaskRelations(parent.id);
  const [labelsPending, setLabelsPending] = useState(false);
  const pending = state.pending || relations.pending || labelsPending;
  const created = state.created;
  return (
    <form
      className="space-y-3 rounded-lg border p-3"
      aria-label="New subtask"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) {
          event.preventDefault();
          onClose();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void state.create(event.currentTarget);
      }}
    >
      <fieldset disabled={pending || state.uncertain} className="min-w-0 space-y-3">
        <Input
          name="title"
          aria-label="Subtask title"
          placeholder="Subtask title"
          required
          maxLength={250}
          autoFocus
        />
        <SubtaskProperties parent={parent} onPendingChange={setLabelsPending} />
        <Button type="submit" disabled={Boolean(created?.relationError)}>
          Add subtask
        </Button>
      </fieldset>
      {created ? (
        <div role="status" className="space-y-2 text-sm">
          <p>
            Created:{" "}
            <Link
              className="underline"
              to="/tasks/$taskId"
              params={{ taskId: created.task.id }}
              search={{ returnTo: `/tasks/${parent.id}` }}
            >
              {created.task.title}
            </Link>
          </p>
          {created.labelError ? <p>{created.labelError}</p> : null}
          {created.relationError ? (
            <>
              <p>{created.relationError}</p>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={async () => {
                  if (
                    await relations.change({
                      taskId: parent.id,
                      otherTaskId: created.task.id,
                      kind: "SUBTASK",
                    })
                  )
                    state.setCreated({ ...created, relationError: null });
                }}
              >
                Retry linking created task
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      {state.error || relations.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error || relations.error}
        </p>
      ) : null}
      {state.uncertain ? (
        <Button type="button" variant="outline" onClick={() => state.setUncertain(false)}>
          I checked the task list; no task was created
        </Button>
      ) : null}
      <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
        Close subtask form
      </Button>
    </form>
  );
}
