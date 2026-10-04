import { useQuery } from "@apollo/client/react";
import { useLocation } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  ProjectsDocument,
  SessionDocument,
  TaskListDocument,
  type TaskListQuery,
  type TaskScope,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import type { ListSearch } from "./list-search";
import { IssueList, ListMessage, ListSettingsError } from "./list-state";
import { LongTermTasks } from "./long-term-tasks";
import { paginationRange } from "./pagination-range";
import { TaskActionFeedback } from "./task-action-feedback";
import { TaskListHeader } from "./task-list-header";
import { TaskListLoading } from "./task-list-loading";
import { type TaskItem, TaskRow } from "./task-row";
import { useTaskListActions } from "./use-task-list-actions";
import { useTaskRefreshFeedback } from "./use-task-refresh-feedback";

type TaskListPageProps = {
  navigation?: ReactNode;
  title: string;
  description: string;
  scope: TaskScope;
  search: ListSearch;
  setSearch: (next: ListSearch) => void;
};

export function TaskListPage({
  title,
  description,
  scope,
  search,
  setSearch,
  navigation,
}: TaskListPageProps) {
  const location = useLocation();
  const supportsLabels = scope === "TODAY" || scope === "UNSCHEDULED" || scope === "LONG_TERM";
  const { data: sessionData, error: sessionError } = useQuery(SessionDocument);
  const { data: projectData, error: projectError } = useQuery(ProjectsDocument);
  const { data, loading, error, refetch } = useQuery(TaskListDocument, {
    variables: {
      input: {
        scope,
        page: search.page,
        pageSize: 30,
        projectId: search.project === "all" ? null : search.project,
        ...(supportsLabels && search.label ? { labelId: search.label } : {}),
      },
    },
    fetchPolicy: "cache-and-network",
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
        description={description}
        projects={projectData?.projects.items ?? []}
        supportsLabels={supportsLabels}
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
          dataLoaded={Boolean(data)}
          error={error}
          loading={loading}
          scope={scope}
          taskPage={taskPage}
          returnTo={returnTo}
          completingTaskID={actions.completingTaskID}
          onComplete={actions.markDone}
        />
      </div>
      {taskPage?.isComplete && taskPage.totalPages > 1 ? (
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
  dataLoaded,
  error,
  loading,
  scope,
  taskPage,
  returnTo,
  completingTaskID,
  onComplete,
}: {
  dataLoaded: boolean;
  error: unknown;
  loading: boolean;
  scope: TaskScope;
  taskPage: TaskListQuery["tasks"] | undefined;
  returnTo: string;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
}) {
  if (loading && !dataLoaded) return <TaskListLoading />;
  if (error && !taskPage) {
    return (
      <ListMessage tone="error">
        {graphQLErrorMessage(error, "Tasks could not be loaded. Try refreshing this page.")}
      </ListMessage>
    );
  }
  if (!taskPage?.isComplete) return <IssueList issues={taskPage?.issues ?? []} />;
  if (taskPage.items.length === 0) return <ListMessage>No tasks here.</ListMessage>;
  if (scope === "UNSCHEDULED" || scope === "LONG_TERM") {
    const Group = scope === "LONG_TERM" ? LongTermTasks : GroupedTasks;
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
          returnTo={returnTo}
          completingTaskID={completingTaskID}
          onComplete={onComplete}
        />
      ))}
    </div>
  );
}

function TaskPagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <Pagination className="mt-5">
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Go to previous page"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </Button>
        </PaginationItem>
        {paginationRange(currentPage, totalPages).map((item) => (
          <PaginationItem key={item}>
            {typeof item === "string" ? (
              <PaginationEllipsis />
            ) : (
              <Button
                variant={item === currentPage ? "outline" : "ghost"}
                size="icon"
                aria-current={item === currentPage ? "page" : undefined}
                aria-label={`Go to page ${item}`}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Go to next page"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function GroupedTasks(props: {
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
