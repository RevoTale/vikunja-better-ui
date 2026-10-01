import { Link } from "@tanstack/react-router";
import { Check, Circle, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RelatedTaskFieldsFragment } from "@/graphql/graphql";

export function RelationGroup({
  title,
  items,
  returnTo,
  pending,
  canEdit,
  onRemove,
  onAdd,
}: {
  title: string;
  items: RelatedTaskFieldsFragment[];
  returnTo: string;
  pending: boolean;
  canEdit: boolean;
  onRemove: (task: RelatedTaskFieldsFragment) => void;
  onAdd?: () => void;
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          {title}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {items.filter((task) => task.isDone).length}/{items.length}
          </span>
        </h2>
        {canEdit && onAdd ? (
          <Button variant="ghost" size="sm" className="min-h-11" disabled={pending} onClick={onAdd}>
            Link {title === "Subtasks" ? "subtask" : "task"}
          </Button>
        ) : null}
      </div>
      <ul className="divide-y">
        {items.map((task) => (
          <li key={task.id} className="flex min-h-11 items-center gap-2 py-1">
            {task.isDone ? (
              <Check aria-label="Completed" className="size-4 shrink-0" />
            ) : (
              <Circle aria-label="Incomplete" className="size-4 shrink-0 text-muted-foreground" />
            )}
            <Link
              className="min-w-0 flex-1 text-sm underline-offset-4 hover:underline wrap-anywhere"
              to="/tasks/$taskId"
              params={{ taskId: task.id }}
              search={{ returnTo }}
            >
              {task.title}
            </Link>
            {canEdit ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                disabled={pending}
                aria-label={`Unlink ${task.title}`}
                onClick={() => onRemove(task)}
              >
                <Unlink className="size-4" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">None linked.</p> : null}
    </section>
  );
}
