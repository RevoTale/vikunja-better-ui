import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { WeekQuery } from "@/graphql/graphql";
import { cn } from "@/lib/utils";
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
  createProjectID,
}: {
  day: WeekQuery["week"]["days"][number];
  returnTo: string;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
  isToday: boolean;
  headingLevel: 2 | 3;
  createProjectID: string | undefined;
}) {
  const entries = mergeWeekEntries(day.tasks, day.projections);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section
      id={isToday ? "week-today" : undefined}
      className="grid scroll-mt-20 border-t md:grid-cols-[8rem_minmax(0,1fr)]"
      data-slot="week-day"
      data-date={day.date}
      data-today={isToday ? "" : undefined}
    >
      <header className="px-3 py-3 md:border-r md:px-4 md:py-4">
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
          {entries.length === 0
            ? "No tasks"
            : `${day.tasks.length} active · ${day.projections.length} computed`}
        </p>
      </header>
      <div className="grid content-start gap-2 border-t px-3 py-3 md:border-t-0 md:px-4 md:py-4">
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
        <Link
          to="/tasks/new"
          search={{
            type: "one-time",
            returnTo,
            date: day.date,
            ...(createProjectID ? { project: createProjectID } : {}),
          }}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "min-h-11 w-full justify-start px-2 text-muted-foreground md:min-h-8",
          )}
          aria-label={`Add task for ${formatDayName(day.date)}, ${formatDayDate(day.date)}`}
        >
          <Plus aria-hidden="true" /> Add task
        </Link>
      </div>
    </section>
  );
}
