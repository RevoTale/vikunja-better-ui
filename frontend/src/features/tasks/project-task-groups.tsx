import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { type TaskItem, TaskRow } from "./task-row";

export function ProjectTaskGroups(props: {
  countLoading: boolean;
  tasks: TaskItem[];
  returnTo: string;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
}) {
  const groups = useMemo(() => {
    const result = new Map<string, TaskItem[]>();
    for (const task of props.tasks) {
      const key = `${task.project.id}:${task.project.title}`;
      result.set(key, [...(result.get(key) ?? []), task]);
    }
    return result;
  }, [props.tasks]);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  return (
    <div className="grid gap-4 sm:gap-5">
      {Array.from(groups, ([key, tasks]) => {
        const title = tasks[0]?.project.title ?? "Project";
        const isClosed = closed.has(key);
        return (
          <section key={key}>
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-2 text-left font-serif text-xl font-semibold"
              aria-expanded={!isClosed}
              onClick={() =>
                setClosed((current) => {
                  const next = new Set(current);
                  next.has(key) ? next.delete(key) : next.add(key);
                  return next;
                })
              }
            >
              {isClosed ? <ChevronRight /> : <ChevronDown />}
              {title}
              <span className="text-sm font-normal text-muted-foreground">{tasks.length}</span>
            </button>
            {!isClosed ? (
              <div className="grid gap-2 sm:gap-3">
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} {...props} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
