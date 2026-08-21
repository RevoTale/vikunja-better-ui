import { useQuery } from "@apollo/client/react";
import { useLocation } from "@tanstack/react-router";
import { AlertTriangle, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { AppSelect } from "@/components/app-select";
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
import { cn } from "@/lib/utils";
import type { ListSearch } from "./list-search";
import { paginationRange } from "./pagination-range";
import { type TaskItem, TaskRow } from "./task-row";
import { useTaskListActions } from "./use-task-list-actions";
import { useTaskRefreshFeedback } from "./use-task-refresh-feedback";

type TaskListPageProps = {
  title: string;
  description: string;
  scope: TaskScope;
  search: ListSearch;
  setSearch: (next: ListSearch) => void;
};

export function TaskListPage({ title, description, scope, search, setSearch }: TaskListPageProps) {
  const location = useLocation();
  const { data: sessionData, error: sessionError } = useQuery(SessionDocument);
  const { data: projectData, error: projectError } = useQuery(ProjectsDocument);
  const { data, loading, error, refetch } = useQuery(TaskListDocument, {
    variables: {
      input: {
        scope,
        page: search.page,
        pageSize: 30,
        projectId: search.project === "all" ? null : search.project,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 id="page-title" className="font-serif text-3xl font-semibold">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
          onValueChange={(project) => setSearch({ project, page: 1 })}
        />
      </div>
      <div className="mt-4 sm:mt-6" aria-busy={loading}>
        {!error && (sessionError || projectError) ? (
          <ListMessage tone="error">
            {graphQLErrorMessage(
              sessionError ?? projectError,
              "Task settings could not be loaded. Refresh the page and try again.",
            )}
          </ListMessage>
        ) : null}
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
      <div className="sr-only" aria-live="polite">
        {actions.notice}
      </div>
      {actions.notice ? (
        <p className="mt-4 rounded-md border bg-muted p-3 text-sm" role="status">
          {actions.notice}
        </p>
      ) : null}
      {actions.undo ? (
        <div className="fixed bottom-20 left-4 right-4 z-30 flex items-center justify-between gap-3 rounded-md border bg-card p-3 shadow-lg sm:left-auto sm:right-6 sm:w-96 lg:bottom-6">
          <span className="min-w-0 truncate text-sm">{actions.undo.title} completed</span>
          <Button size="sm" variant="outline" onClick={actions.restore} disabled={actions.undoing}>
            <RotateCcw /> Undo
          </Button>
        </div>
      ) : null}
      {actions.repairInfo ? (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm">
            Renewal is complete. Repair the due-time adjustment or missing Vikunja History entry.
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={actions.repairHistory}
            disabled={actions.repairing}
          >
            {actions.repairing ? "Repairing…" : "Repair history"}
          </Button>
        </div>
      ) : null}
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
  if (loading && !dataLoaded) return <ListMessage>Loading tasks…</ListMessage>;
  if (error && !taskPage) {
    return (
      <ListMessage tone="error">
        {graphQLErrorMessage(error, "Tasks could not be loaded. Try refreshing this page.")}
      </ListMessage>
    );
  }
  if (!taskPage?.isComplete) return <IssueList issues={taskPage?.issues ?? []} />;
  if (taskPage.items.length === 0) return <ListMessage>No tasks here.</ListMessage>;
  if (scope === "UNSCHEDULED") {
    return (
      <GroupedTasks
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

function ListMessage({ children, tone }: { children: string; tone?: "error" }) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground",
        tone === "error" && "border-destructive/50 text-destructive",
      )}
      role={tone === "error" ? "alert" : undefined}
    >
      {children}
    </div>
  );
}
function IssueList({ issues }: { issues: { code: string; message: string }[] }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4" role="alert">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle /> This list is incomplete
      </p>
      {issues.map((issue) => (
        <p className="mt-2 text-sm" key={`${issue.code}:${issue.message}`}>
          {issue.message}
        </p>
      ))}
    </div>
  );
}
