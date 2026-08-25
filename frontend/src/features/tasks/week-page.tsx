import { useQuery } from "@apollo/client/react";
import { useLocation } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CircleDashed } from "lucide-react";
import { useEffect, useRef } from "react";

import { AppSelect } from "@/components/app-select";
import { Button } from "@/components/ui/button";
import { ProjectsDocument, SessionDocument, WeekDocument, type WeekQuery } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { ListMessage } from "./list-state";
import { TaskActionFeedback } from "./task-action-feedback";
import { useTaskListActions } from "./use-task-list-actions";
import { useTaskRefreshFeedback } from "./use-task-refresh-feedback";
import { WeekContent } from "./week-content";
import { formatWeekRange } from "./week-date-format";
import { shiftLocalDate, type WeekSearch } from "./week-search";

type WeekPageProps = {
  search: WeekSearch;
  setSearch: (next: WeekSearch) => void;
};

export function WeekPage({ search, setSearch }: WeekPageProps) {
  const location = useLocation();
  const pendingTodayScroll = useRef(false);
  const {
    data: sessionData,
    error: sessionError,
    loading: sessionLoading,
  } = useQuery(SessionDocument);
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
  const timezonePending = sessionLoading && !sessionData;
  const contentLoading = loading || timezonePending;
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

      <div className="mt-5" aria-busy={contentLoading}>
        {!error && (sessionError || projectError) ? (
          <ListMessage tone="error">
            {graphQLErrorMessage(
              sessionError ?? projectError,
              "Week settings could not be loaded. Refresh the page and try again.",
            )}
          </ListMessage>
        ) : null}
        <WeekContent
          dataLoaded={Boolean(data) && !timezonePending}
          error={error}
          loading={contentLoading}
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
