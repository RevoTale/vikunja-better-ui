import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

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
      className={cn(
        "grid scroll-mt-20 border-t md:grid-cols-[8rem_minmax(0,1fr)]",
        isToday && "border-t-2 border-t-primary/40",
      )}
      data-slot="week-day"
      data-date={day.date}
      data-today={isToday ? "" : undefined}
    >
      {isToday ? (
        <h2
          data-slot="week-boundary"
          className="col-span-full border-b bg-muted/50 px-3 py-2 text-sm font-semibold tracking-tight md:px-4"
        >
          Today
        </h2>
      ) : null}
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
                startAt: entry.projection.startAt,
                endAt: entry.projection.endAt,
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
