import { useQuery } from "@apollo/client/react";
import { useLocation } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { LoadFailure } from "@/components/load-failure";
import { DayDocument, type DayQuery, ProjectsDocument, type SessionQuery } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import type { DaySearch } from "./day-search";
import { IssueList, ListSettingsError } from "./list-state";
import { TaskActionFeedback } from "./task-action-feedback";
import { TaskListHeader } from "./task-list-header";
import { TaskListLoading } from "./task-list-loading";
import { useTaskListActions } from "./use-task-list-actions";
import { useTaskRefreshFeedback } from "./use-task-refresh-feedback";
import { formatDayDate, formatDayName } from "./week-date-format";
import { WeekDaySection } from "./week-day-section";

export function FutureDayPage({
  search,
  date,
  setSearch,
  navigation,
  session,
  sessionError,
}: {
  search: DaySearch;
  date: string;
  setSearch: (next: DaySearch) => void;
  navigation: ReactNode;
  session: SessionQuery | undefined;
  sessionError: Error | undefined;
}) {
  const location = useLocation();
  const { data: projects, error: projectError } = useQuery(ProjectsDocument);
  const { data, loading, error, refetch } = useQuery(DayDocument, {
    variables: {
      input: {
        date,
        projectId: search.project === "all" ? null : search.project,
        labelId: search.label ?? null,
        priority: search.priority ?? null,
      },
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const actions = useTaskListActions(session?.session.csrfToken ?? undefined, refetch);
  const view = data?.day.day.date === date ? data.day : undefined;
  useTaskRefreshFeedback({
    refreshing: loading && Boolean(view),
    errorMessage:
      error && view
        ? graphQLErrorMessage(
            error,
            "Day tasks could not be refreshed. Showing previously loaded data.",
          )
        : undefined,
  });
  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="page-title">
      <TaskListHeader
        title={`${formatDayName(date)}, ${formatDayDate(date)}`}
        description="Real tasks and computed scheduled cycles, assuming earlier cycles are completed."
        projects={projects?.projects.items ?? []}
        supportsLabels
        supportsPriority
        search={search}
        setSearch={setSearch}
        navigation={navigation}
      />
      <div className="mt-4" aria-busy={loading}>
        <ListSettingsError
          taskError={error}
          sessionError={sessionError}
          projectError={projectError}
          message="Day settings could not be loaded. Refresh the page and try again."
        />
        <DayContent
          view={view}
          error={error}
          countLoading={loading}
          returnTo={`${location.pathname}${location.searchStr}`}
          completingTaskID={actions.completingTaskID}
          onComplete={actions.markDone}
          isToday={false}
          headingLevel={2}
          createProjectID={search.project === "all" ? undefined : search.project}
        />
      </div>
      <TaskActionFeedback actions={actions} />
    </section>
  );
}

function DayContent({
  view,
  error,
  ...props
}: Omit<ComponentProps<typeof WeekDaySection>, "day"> & {
  view: DayQuery["day"] | undefined;
  error: unknown;
}) {
  if (!view)
    return error ? (
      <LoadFailure>Day tasks could not be loaded. Try refreshing this page.</LoadFailure>
    ) : (
      <TaskListLoading />
    );
  if (!view.isComplete) return <IssueList issues={view.issues} />;
  return (
    <div className="overflow-hidden rounded-lg border">
      <WeekDaySection day={view.day} {...props} />
    </div>
  );
}
