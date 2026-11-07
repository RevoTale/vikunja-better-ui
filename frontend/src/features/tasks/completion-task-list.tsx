import { currentDateInTimeZone } from "./local-date-time";
import { type PlanningPeriod, taskFinishDate } from "./planning-dates";
import { type TaskItem, TaskRow } from "./task-row";

export function CompletionTaskList({
  tasks,
  period,
  ...props
}: {
  tasks: TaskItem[];
  period?: PlanningPeriod | undefined;
  returnTo: string;
  countLoading: boolean;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
}) {
  const groups = { attention: [] as TaskItem[], current: [] as TaskItem[] };
  for (const task of tasks) {
    const today = currentDateInTimeZone(task.timezone);
    const finish = taskFinishDate(task, period, today);
    const boundary = period?.from ?? today;
    groups[finish && boundary && finish < boundary ? "attention" : "current"].push(task);
  }
  return (
    <div className="grid gap-5">
      {(
        [
          ["attention", "Needs attention"],
          ["current", period ? "In this period" : "Finish today"],
        ] as const
      ).map(([key, title]) =>
        groups[key].length ? (
          <section key={key} aria-label={title} className="grid gap-2 sm:gap-3">
            {groups.attention.length ? (
              <h2 className="font-serif text-xl font-semibold">{title}</h2>
            ) : null}
            {groups[key].map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                {...props}
                scheduleContext={{ period, backlog: true }}
              />
            ))}
          </section>
        ) : null,
      )}
    </div>
  );
}
