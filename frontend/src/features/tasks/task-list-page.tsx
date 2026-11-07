import { useQuery } from "@apollo/client/react";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LoadFailure } from "@/components/load-failure";
import {
  type ActiveWorkOrderInput,
  ProjectsDocument,
  SessionDocument,
  TaskListDocument,
  type TaskListQuery,
  type TaskScope,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { ActiveWorkCount } from "./active-work-count";
import { CompletionTaskList } from "./completion-task-list";
import type { ListSearch } from "./list-search";
import { IssueList, ListMessage, ListSettingsError } from "./list-state";
import { LongTermTasks } from "./long-term-tasks";
import type { PlanningPeriod } from "./planning-dates";
import { ProjectTaskGroups } from "./project-task-groups";
import { RecurringGroups } from "./recurring-groups";
import { TaskActionFeedback } from "./task-action-feedback";
import { TaskListHeader } from "./task-list-header";
import { TaskListLoading } from "./task-list-loading";
import { TaskPagination } from "./task-pagination";
import { type TaskItem, TaskRow } from "./task-row";
import { useTaskListActions } from "./use-task-list-actions";
import { useTaskRefreshFeedback } from "./use-task-refresh-feedback";

const groupedLists: Partial<Record<TaskScope, typeof LongTermTasks>> = {
  UNSCHEDULED: ProjectTaskGroups,
  LONG_TERM: LongTermTasks,
  RECURRING: RecurringGroups,
};

type TaskListPageProps = {
  activeOrder?: ActiveWorkOrderInput;
  period?: PlanningPeriod;
  navigation?: ReactNode;
  title: string;
  description: string;
  scope: TaskScope;
  search: ListSearch;
  setSearch: (next: ListSearch) => void;
};

export function TaskListPage({
  activeOrder,
  title,
  description,
  scope,
  search,
  setSearch,
  navigation,
  period,
}: TaskListPageProps) {
  const location = useLocation();
  const supportsLabels = [
    "TODAY",
    "UNSCHEDULED",
    "LONG_TERM",
    "ACTIVE",
    "PERIOD",
    "RECURRING",
  ].includes(scope);
  const supportsPriority = supportsLabels || scope === "JOBS";
  const { data: sessionData, error: sessionError } = useQuery(SessionDocument);
  const { data: projectData, error: projectError } = useQuery(ProjectsDocument);
  const { data, loading, error, refetch } = useQuery(TaskListDocument, {
    variables: {
      input: {
        scope,
        ...(activeOrder ? { activeOrder } : {}),
        ...period,
        page: search.page,
        pageSize: 30,
        projectId: search.project === "all" ? null : search.project,
        ...(supportsLabels && search.label ? { labelId: search.label } : {}),
        ...(supportsPriority && search.priority ? { priority: search.priority } : {}),
      },
    },
    fetchPolicy: "cache-and-network",
    pollInterval: ["TODAY", "ACTIVE", "PERIOD", "RECURRING"].includes(scope) ? 60_000 : 0,
    skipPollAttempt: () => document.visibilityState !== "visible",
    notifyOnNetworkStatusChange: true,
  });
  const returnTo = `${location.pathname}${location.searchStr}`;
  const actions = useTaskListActions(sessionData?.session.csrfToken ?? undefined, refetch);

  const taskPage = data?.tasks;
  const backgroundError =
    error && taskPage
      ? graphQLErrorMessage(error, "Tasks could not be refreshed. Showing previously loaded data.")
      : undefined;
  useTaskRefreshFeedback({
    refreshing: loading && Boolean(taskPage),
    errorMessage: backgroundError,
  });

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="page-title">
      <TaskListHeader
        navigation={navigation}
        title={title}
        titleSuffix={
          <ActiveWorkCount scope={scope} page={taskPage} loading={loading} error={error} />
        }
        description={description}
        projects={projectData?.projects.items ?? []}
        supportsLabels={supportsLabels}
        supportsPriority={supportsPriority}
        search={search}
        setSearch={setSearch}
      />
      <div className="mt-4 sm:mt-6" aria-busy={loading}>
        <ListSettingsError
          taskError={error}
          sessionError={sessionError}
          projectError={projectError}
          message="Task settings could not be loaded. Refresh the page and try again."
        />
        <TaskListContent
          emptyMessage={emptyListMessage(scope, search)}
          dataLoaded={Boolean(data)}
          error={error}
          loading={loading}
          scope={scope}
          period={period}
          taskPage={taskPage}
          returnTo={returnTo}
          completingTaskID={actions.completingTaskID}
          onComplete={actions.markDone}
        />
      </div>
      {taskPage?.isComplete && taskPage.totalPages > 0 ? (
        <TaskPagination
          currentPage={taskPage.page}
          totalPages={taskPage.totalPages}
          onPageChange={(page) => setSearch({ ...search, page })}
        />
      ) : null}
      <TaskActionFeedback actions={actions} />
    </section>
  );
}

function TaskListContent({
  emptyMessage,
  dataLoaded,
  error,
  loading,
  scope,
  period,
  taskPage,
  returnTo,
  completingTaskID,
  onComplete,
}: {
  emptyMessage: string;
  dataLoaded: boolean;
  error: unknown;
  loading: boolean;
  scope: TaskScope;
  period: PlanningPeriod | undefined;
  taskPage: TaskListQuery["tasks"] | undefined;
  returnTo: string;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
}) {
  if (loading && !dataLoaded) return <TaskListLoading />;
  if (error && !taskPage) {
    return (
      <LoadFailure>
        {graphQLErrorMessage(error, "Tasks could not be loaded. Try refreshing this page.")}
      </LoadFailure>
    );
  }
  if (!taskPage?.isComplete) return <IssueList issues={taskPage?.issues ?? []} />;
  if (taskPage.items.length === 0)
    return (
      <ListMessage>
        {taskPage.totalPages > 0 ? "No tasks remain on this page." : emptyMessage}
      </ListMessage>
    );
  if (scope === "TODAY" || scope === "PERIOD")
    return (
      <CompletionTaskList
        tasks={taskPage.items}
        period={period}
        countLoading={loading}
        returnTo={returnTo}
        completingTaskID={completingTaskID}
        onComplete={onComplete}
      />
    );
  const Group = groupedLists[scope];
  if (Group) {
    return (
      <Group
        countLoading={loading}
        tasks={taskPage.items}
        returnTo={returnTo}
        completingTaskID={completingTaskID}
        onComplete={onComplete}
      />
    );
  }
  return (
    <div className="grid gap-2 sm:gap-3">
      {taskPage.items.map((task) => (
        <TaskRow
          countLoading={loading}
          key={task.id}
          task={task}
          scheduleContext={{ active: scope === "ACTIVE" }}
          returnTo={returnTo}
          completingTaskID={completingTaskID}
          onComplete={onComplete}
        />
      ))}
    </div>
  );
}

function emptyListMessage(scope: TaskScope, search: ListSearch): string {
  if (
    (scope === "TODAY" || scope === "ACTIVE" || scope === "RECURRING") &&
    (search.project !== "all" || search.label || search.priority)
  )
    return "No tasks match these filters.";
  if (scope === "RECURRING")
    return "No recurring tasks yet. Choose New recurring task to add your first routine.";
  if (scope === "TODAY") return "Nothing left to finish today.";
  if (scope === "ACTIVE")
    return "No active planning windows. Add a planning window to a task to find it here.";
  return "No tasks here.";
}
