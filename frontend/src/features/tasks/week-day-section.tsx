import { Badge } from "@/components/ui/badge";
import type { WeekQuery } from "@/graphql/graphql";
import { type TaskItem, TaskRow } from "./task-row";
import { formatDayDate, formatDayName } from "./week-date-format";
import { mergeWeekEntries } from "./week-entries";

export function WeekDaySection({
  day,
  returnTo,
  completingTaskID,
  onComplete,
  isToday,
  headingLevel,
}: {
  day: WeekQuery["week"]["days"][number];
  returnTo: string;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
  isToday: boolean;
  headingLevel: 2 | 3;
}) {
  const count = day.tasks.length + day.projections.length;
  const entries = mergeWeekEntries(day.tasks, day.projections);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section
      id={isToday ? "week-today" : undefined}
      className="grid scroll-mt-4 gap-3 border-t py-4 sm:py-5 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-4"
      data-slot="week-day"
      data-date={day.date}
      data-today={isToday ? "" : undefined}
    >
      <header>
        <Heading className="text-lg font-semibold tracking-tight">
          {formatDayName(day.date)}
        </Heading>
        <time
          dateTime={day.date}
          aria-current={isToday ? "date" : undefined}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          {formatDayDate(day.date)}
          {isToday ? <Badge variant="secondary">Today</Badge> : null}
        </time>
        <p className="mt-1 text-xs text-muted-foreground">
          {count === 0
            ? "No tasks"
            : `${day.tasks.length} active · ${day.projections.length} computed`}
        </p>
      </header>
      {count > 0 ? (
        <div className="grid gap-2 sm:gap-3">
          {entries.map((entry) =>
            entry.kind === "task" ? (
              <TaskRow
                key={entry.task.id}
                task={entry.task}
                returnTo={returnTo}
                completingTaskID={completingTaskID}
                onComplete={onComplete}
                dayGrouped
                showRecurrenceHint
              />
            ) : (
              <TaskRow
                key={`${entry.projection.sourceTask.id}:${entry.projection.dueAt}`}
                task={{
                  ...entry.projection.sourceTask,
                  dueAt: entry.projection.dueAt,
                  hasDueTime: entry.projection.hasDueTime,
                  isOverdue: false,
                }}
                returnTo={returnTo}
                completingTaskID={completingTaskID}
                onComplete={onComplete}
                dayGrouped
                projection
              />
            ),
          )}
        </div>
      ) : null}
    </section>
  );
}
