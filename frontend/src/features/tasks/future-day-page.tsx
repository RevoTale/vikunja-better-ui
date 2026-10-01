import { useQuery } from "@apollo/client/react";
import { useLocation } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { AppSelect } from "@/components/app-select";
import { DayDocument, type DayQuery, ProjectsDocument, type SessionQuery } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import type { DaySearch } from "./day-search";
import { IssueList, ListMessage, ListSettingsError } from "./list-state";
import { TaskActionFeedback } from "./task-action-feedback";
import { TaskLabelFilter } from "./task-label-filter";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="page-title" className="font-serif text-3xl font-semibold">
            {formatDayName(date)}, {formatDayDate(date)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real tasks and computed scheduled cycles, assuming earlier cycles are completed.
          </p>
        </div>
        <AppSelect
          aria-label="Project"
          className="sm:w-64"
          value={search.project}
          options={[
            { value: "all", label: "All projects" },
            ...(projects?.projects.items.map((project) => ({
              value: project.id,
              label: project.title,
            })) ?? []),
          ]}
          onValueChange={(project) => setSearch({ ...search, project, page: 1 })}
        />
      </div>
      {navigation}
      <TaskLabelFilter
        value={search.label ?? "all"}
        onChange={(label) => {
          const { label: _label, ...filters } = search;
          setSearch({ ...filters, page: 1, ...(label !== "all" ? { label } : {}) });
        }}
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
      <ListMessage tone="error">
        Day tasks could not be loaded. Try refreshing this page.
      </ListMessage>
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
