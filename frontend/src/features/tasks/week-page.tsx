import { useQuery } from "@apollo/client/react";
import { useLocation } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CircleDashed } from "lucide-react";
import { useEffect, useRef } from "react";

import { AppSelect } from "@/components/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectsDocument, SessionDocument, WeekDocument, type WeekQuery } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { IssueList, ListMessage } from "./list-state";
import { TaskActionFeedback } from "./task-action-feedback";
import { type TaskItem, TaskRow } from "./task-row";
import { useTaskListActions } from "./use-task-list-actions";
import { useTaskRefreshFeedback } from "./use-task-refresh-feedback";
import { mergeWeekEntries } from "./week-entries";
import { shiftLocalDate, type WeekSearch } from "./week-search";

type WeekPageProps = {
  search: WeekSearch;
  setSearch: (next: WeekSearch) => void;
};

export function WeekPage({ search, setSearch }: WeekPageProps) {
  const location = useLocation();
  const pendingTodayScroll = useRef(false);
  const { data: sessionData, error: sessionError } = useQuery(SessionDocument);
  const { data: projectData, error: projectError } = useQuery(ProjectsDocument);
  const { data, loading, error, refetch } = useQuery(WeekDocument, {
    variables: {
      input: {
        containing: search.week ?? null,
        projectId: search.project === "all" ? null : search.project,
      },
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const actions = useTaskListActions(sessionData?.session.csrfToken ?? undefined, refetch);
  const week = data?.week;
  const timezone = sessionData?.session.vikunjaUser?.timezone;
  const today = timezone ? currentLocalDate(timezone) : undefined;
  const returnTo = `${location.pathname}${location.searchStr}`;
  const backgroundError =
    error && week
      ? graphQLErrorMessage(
          error,
          "Week tasks could not be refreshed. Showing previously loaded data.",
        )
      : undefined;
  useTaskRefreshFeedback({ refreshing: loading && Boolean(week), errorMessage: backgroundError });

  useEffect(() => {
    if (!pendingTodayScroll.current || !today || !week?.days.some((day) => day.date === today)) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      pendingTodayScroll.current = false;
      scrollToToday();
    });
    return () => cancelAnimationFrame(frame);
  }, [today, week]);

  const navigateToWeek = (week?: string) => {
    pendingTodayScroll.current = false;
    setSearch(week ? { project: search.project, week } : { project: search.project });
  };

  const showToday = () => {
    if (!today) return;
    if (week?.days.some((day) => day.date === today)) {
      scrollToToday();
      return;
    }
    pendingTodayScroll.current = true;
    setSearch({ project: search.project });
  };

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="page-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 id="page-title" className="text-3xl font-semibold tracking-tight">
            {search.week ? "Week" : "This week"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {week
              ? formatWeekRange(week.startsOn, week.endsOn)
              : "Active and computed recurring work."}
          </p>
        </div>
        <AppSelect
          aria-label="Project"
          className="sm:w-64"
          value={search.project}
          options={[
            { value: "all", label: "All projects" },
            ...(projectData?.projects.items.map((project) => ({
              value: project.id,
              label: project.title,
            })) ?? []),
          ]}
          onValueChange={(project) => setSearch({ ...search, project })}
        />
      </div>

      <WeekNavigation
        week={week}
        todayDisabled={!today}
        onNavigate={navigateToWeek}
        onToday={showToday}
      />

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span>Solid card: active task</span>
        <span className="inline-flex items-center gap-1.5">
          <CircleDashed className="size-3.5" aria-hidden="true" /> Computed scheduled cycle
        </span>
      </div>

      <div className="mt-5" aria-busy={loading}>
        {!error && (sessionError || projectError) ? (
          <ListMessage tone="error">
            {graphQLErrorMessage(
              sessionError ?? projectError,
              "Week settings could not be loaded. Refresh the page and try again.",
            )}
          </ListMessage>
        ) : null}
        <WeekContent
          dataLoaded={Boolean(data)}
          error={error}
          loading={loading}
          week={week}
          returnTo={returnTo}
          completingTaskID={actions.completingTaskID}
          onComplete={actions.markDone}
          today={today}
        />
      </div>
      <TaskActionFeedback actions={actions} />
    </section>
  );
}

function WeekNavigation({
  week,
  todayDisabled,
  onNavigate,
  onToday,
}: {
  week: WeekQuery["week"] | undefined;
  todayDisabled: boolean;
  onNavigate: (week?: string) => void;
  onToday: () => void;
}) {
  return (
    <nav className="mt-4 flex flex-wrap gap-2" aria-label="Week navigation">
      <Button
        variant="outline"
        disabled={!week}
        onClick={() => week && onNavigate(shiftLocalDate(week.startsOn, -7))}
      >
        <ChevronLeft /> Previous
      </Button>
      <Button variant="outline" disabled={todayDisabled} onClick={onToday}>
        Today
      </Button>
      <Button
        variant="outline"
        disabled={!week}
        onClick={() => week && onNavigate(shiftLocalDate(week.startsOn, 7))}
      >
        Next <ChevronRight />
      </Button>
    </nav>
  );
}

function WeekContent({
  dataLoaded,
  error,
  loading,
  week,
  returnTo,
  completingTaskID,
  onComplete,
  today,
}: {
  dataLoaded: boolean;
  error: unknown;
  loading: boolean;
  week: WeekQuery["week"] | undefined;
  returnTo: string;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
  today: string | undefined;
}) {
  if (loading && !dataLoaded) return <ListMessage>Loading week…</ListMessage>;
  if (error && !week) {
    return (
      <ListMessage tone="error">
        Week tasks could not be loaded. Try refreshing this page.
      </ListMessage>
    );
  }
  if (!week?.isComplete) return <IssueList issues={week?.issues ?? []} />;

  return (
    <div className="border-b">
      {week.days.map((day) => (
        <WeekDaySection
          key={day.date}
          day={day}
          returnTo={returnTo}
          completingTaskID={completingTaskID}
          onComplete={onComplete}
          isToday={day.date === today}
        />
      ))}
    </div>
  );
}

function WeekDaySection({
  day,
  returnTo,
  completingTaskID,
  onComplete,
  isToday,
}: {
  day: WeekQuery["week"]["days"][number];
  returnTo: string;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
  isToday: boolean;
}) {
  const count = day.tasks.length + day.projections.length;
  const entries = mergeWeekEntries(day.tasks, day.projections);
  return (
    <section
      id={isToday ? "week-today" : undefined}
      className="grid scroll-mt-4 gap-3 border-t py-4 sm:py-5 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-4"
      data-slot="week-day"
      data-date={day.date}
      data-today={isToday ? "" : undefined}
    >
      <header>
        <h2 className="text-lg font-semibold tracking-tight">{formatDayName(day.date)}</h2>
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

function formatWeekRange(start: string, end: string): string {
  return `${formatLocalDate(start, { day: "numeric", month: "short", year: "numeric" })} – ${formatLocalDate(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

function formatDayName(value: string): string {
  return formatLocalDate(value, { weekday: "long" });
}

function formatDayDate(value: string): string {
  return formatLocalDate(value, { day: "numeric", month: "short" });
}

function formatLocalDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00Z`),
  );
}

function currentLocalDate(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values["year"]}-${values["month"]}-${values["day"]}`;
}

function scrollToToday(): void {
  document.getElementById("week-today")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
