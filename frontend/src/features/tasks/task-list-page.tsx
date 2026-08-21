import { useMutation, useQuery } from "@apollo/client/react";
import { useLocation } from "@tanstack/react-router";
import { AlertTriangle, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import {
  CompleteTaskDocument,
  ProjectsDocument,
  RepairTaskMetadataDocument,
  SessionDocument,
  TaskListDocument,
  type TaskScope,
  UndoTaskCompletionDocument,
} from "@/graphql/graphql";
import { cn } from "@/lib/cn";
import { graphQLErrorMessage } from "@/lib/user-error";
import type { ListSearch } from "./list-search";
import { paginationRange } from "./pagination-range";
import { type TaskItem, TaskRow } from "./task-row";

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
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<{ capability: string; title: string }>();
  const [repairInfo, setRepairInfo] = useState<{ capability: string; title: string }>();
  const [complete] = useMutation(CompleteTaskDocument);
  const [completingTaskID, setCompletingTaskID] = useState<string>();
  const [undoCompletion, { loading: undoing }] = useMutation(UndoTaskCompletionDocument);
  const [repair, { loading: repairing }] = useMutation(RepairTaskMetadataDocument);
  const returnTo = `${location.pathname}${location.searchStr}`;

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(undefined), 8_000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  async function markDone(task: TaskItem) {
    setNotice("");
    setCompletingTaskID(task.id);
    try {
      const csrfToken = sessionData?.session.csrfToken;
      if (!csrfToken) throw new Error("missing session");
      const result = await complete({
        variables: {
          input: {
            csrfToken,
            taskId: task.id,
            expectedKind: task.kind,
            expectedDueAt: task.kind === "RECURRING" ? task.dueAt : null,
          },
        },
      });
      const payload = result.data?.completeTask;
      if (!payload) {
        setNotice("Completion could not be confirmed. Refresh the task before trying again.");
        await refetch().catch(() => undefined);
        return;
      }
      let completionNotice: string;
      if (payload.status === "CONFIRMED_REPAIR_REQUIRED") {
        completionNotice =
          "The recurring task renewed, but its due time or History still needs repair.";
        if (payload.repairCapability) {
          setRepairInfo({ capability: payload.repairCapability, title: task.title });
        }
      } else if (task.kind === "RECURRING") {
        completionNotice = "Recurring task completed and renewed.";
      } else {
        completionNotice = `${task.title} completed.`;
        if (payload.undoCapability)
          setUndo({ capability: payload.undoCapability, title: task.title });
      }
      setNotice(completionNotice);
      try {
        await refetch();
      } catch (caught) {
        setNotice(
          `${completionNotice} ${graphQLErrorMessage(
            caught,
            "Refreshed task data could not be loaded.",
          )}`,
        );
      }
    } catch (caught) {
      setNotice(
        graphQLErrorMessage(
          caught,
          "Completion failed. The task was refreshed so you can safely try again.",
        ),
      );
      await refetch().catch(() => undefined);
    } finally {
      setCompletingTaskID(undefined);
    }
  }

  async function restore() {
    if (!undo) return;
    try {
      const csrfToken = sessionData?.session.csrfToken;
      if (!csrfToken) throw new Error("missing session");
      const result = await undoCompletion({
        variables: { input: { csrfToken, capability: undo.capability } },
      });
      if (!result.data?.undoTaskCompletion) {
        setNotice("Undo could not be confirmed. Refresh the task before trying again.");
        return;
      }
      setNotice(`${undo.title} restored.`);
      setUndo(undefined);
      try {
        await refetch();
      } catch (caught) {
        setNotice(
          `${undo.title} restored. ${graphQLErrorMessage(
            caught,
            "Refreshed task data could not be loaded.",
          )}`,
        );
      }
    } catch (caught) {
      setNotice(
        graphQLErrorMessage(
          caught,
          "Undo could not be applied because the task changed or the Undo window expired.",
        ),
      );
    }
  }

  async function repairHistory() {
    if (!repairInfo) return;
    try {
      const csrfToken = sessionData?.session.csrfToken;
      if (!csrfToken) throw new Error("missing session");
      const result = await repair({
        variables: { input: { csrfToken, capability: repairInfo.capability } },
      });
      if (!result.data?.repairTaskMetadata) {
        setNotice(
          "Recurring task repair could not be confirmed. Refresh the task before trying again.",
        );
        return;
      }
      setNotice(`${repairInfo.title} history repaired.`);
      setRepairInfo(undefined);
      try {
        await refetch();
      } catch (caught) {
        setNotice(
          `${repairInfo.title} history repaired. ${graphQLErrorMessage(
            caught,
            "Refreshed task data could not be loaded.",
          )}`,
        );
      }
    } catch (caught) {
      setNotice(
        graphQLErrorMessage(
          caught,
          "Recurring task repair did not finish. It is safe to retry; the task will not renew again.",
        ),
      );
    }
  }

  const taskPage = data?.tasks;
  const content =
    loading && !data ? (
      <ListMessage>Loading tasks…</ListMessage>
    ) : error && !taskPage ? (
      <ListMessage tone="error">
        {graphQLErrorMessage(error, "Tasks could not be loaded. Try refreshing this page.")}
      </ListMessage>
    ) : !taskPage?.isComplete ? (
      <IssueList issues={taskPage?.issues ?? []} />
    ) : taskPage.items.length === 0 ? (
      <ListMessage>No tasks here.</ListMessage>
    ) : scope === "UNSCHEDULED" ? (
      <GroupedTasks
        tasks={taskPage.items}
        returnTo={returnTo}
        completingTaskID={completingTaskID}
        onComplete={markDone}
      />
    ) : (
      <div className="grid gap-2 sm:gap-3">
        {taskPage.items.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            returnTo={returnTo}
            completingTaskID={completingTaskID}
            onComplete={markDone}
          />
        ))}
      </div>
    );

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="page-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 id="page-title" className="font-serif text-3xl font-semibold">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Select
          aria-label="Project"
          className="sm:w-64"
          value={search.project}
          onChange={(event) => setSearch({ project: event.target.value, page: 1 })}
        >
          <option value="all">All projects</option>
          {projectData?.projects.items.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-4 sm:mt-6" aria-busy={loading}>
        {loading && taskPage ? (
          <p className="mb-3 text-sm text-muted-foreground" role="status">
            Refreshing tasks…
          </p>
        ) : null}
        {error && taskPage ? (
          <p
            className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            role="alert"
          >
            {graphQLErrorMessage(
              error,
              "Tasks could not be refreshed. Showing previously loaded data.",
            )}
          </p>
        ) : null}
        {!error && (sessionError || projectError) ? (
          <ListMessage tone="error">
            {graphQLErrorMessage(
              sessionError ?? projectError,
              "Task settings could not be loaded. Refresh the page and try again.",
            )}
          </ListMessage>
        ) : null}
        {content}
      </div>
      {taskPage?.isComplete && taskPage.totalPages > 1 ? (
        <TaskPagination
          currentPage={taskPage.page}
          totalPages={taskPage.totalPages}
          onPageChange={(page) => setSearch({ ...search, page })}
        />
      ) : null}
      <div className="sr-only" aria-live="polite">
        {notice}
      </div>
      {notice ? (
        <p className="mt-4 rounded-md border bg-muted p-3 text-sm" role="status">
          {notice}
        </p>
      ) : null}
      {undo ? (
        <div className="fixed bottom-20 left-4 right-4 z-30 flex items-center justify-between gap-3 rounded-md border bg-card p-3 shadow-lg sm:left-auto sm:right-6 sm:w-96 lg:bottom-6">
          <span className="min-w-0 truncate text-sm">{undo.title} completed</span>
          <Button size="compact" variant="outline" onClick={restore} disabled={undoing}>
            <RotateCcw /> Undo
          </Button>
        </div>
      ) : null}
      {repairInfo ? (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm">
            Renewal is complete. Repair the due-time adjustment or missing Vikunja History entry.
          </p>
          <Button
            className="mt-3"
            size="compact"
            variant="outline"
            onClick={repairHistory}
            disabled={repairing}
          >
            {repairing ? "Repairing…" : "Repair history"}
          </Button>
        </div>
      ) : null}
    </section>
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
          <PaginationPrevious
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          />
        </PaginationItem>
        {paginationRange(currentPage, totalPages).map((item) => (
          <PaginationItem key={item}>
            {typeof item === "string" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationButton
                isActive={item === currentPage}
                aria-label={`Go to page ${item}`}
                onClick={() => onPageChange(item)}
              >
                {item}
              </PaginationButton>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          />
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
