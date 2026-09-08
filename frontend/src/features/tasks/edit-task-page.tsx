import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  ProjectsDocument,
  SessionDocument,
  TaskDetailsDocument,
  UpdateTaskDocument,
  type UpdateTaskInput,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { EditTaskForm } from "./edit-task-form";

export function EditTaskPage({ taskId, returnTo }: { taskId: string; returnTo: string }) {
  const client = useApolloClient();
  const navigate = useNavigate();
  const taskQuery = useQuery(TaskDetailsDocument, {
    variables: { id: taskId },
    fetchPolicy: "network-only",
  });
  const projects = useQuery(ProjectsDocument);
  const session = useQuery(SessionDocument);
  const [update, { loading }] = useMutation(UpdateTaskDocument);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [reloading, setReloading] = useState(false);
  const task = taskQuery.data?.task;

  async function save(input: Omit<UpdateTaskInput, "csrfToken">) {
    const csrfToken = session.data?.session.csrfToken;
    if (!csrfToken) {
      setError("Your session is unavailable. Refresh and sign in again.");
      return;
    }
    setError("");
    try {
      const result = await update({ variables: { input: { ...input, csrfToken } } });
      if (!result.data?.updateTask) throw new Error("Update was not confirmed.");
    } catch (caught) {
      setError(
        graphQLErrorMessage(
          caught,
          "The update could not be confirmed. Reload the task before retrying.",
        ),
      );
      return;
    }
    client.cache.evict({ fieldName: "tasks" });
    client.cache.evict({ fieldName: "week" });
    try {
      await navigate({ to: "/tasks/$taskId", params: { taskId }, search: { returnTo } });
    } catch {
      setError("Saved, but the task page could not be opened. Reload the page.");
    }
  }

  if ((!task && taskQuery.loading) || (!projects.data && projects.loading))
    return <p>Loading task editor…</p>;
  if ((!task && taskQuery.error) || (!projects.data && projects.error))
    return (
      <p role="alert">
        {graphQLErrorMessage(
          taskQuery.error ?? projects.error,
          "Task settings could not be loaded.",
        )}
      </p>
    );
  if (!task) return <p>Task not found.</p>;
  return (
    <section className="mx-auto max-w-2xl">
      <Link
        to="/tasks/$taskId"
        params={{ taskId }}
        search={{ returnTo }}
        className={buttonVariants({ variant: "ghost" })}
      >
        Cancel
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Edit task</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Timezone {task.timezone}. Changes are saved only when you select Save changes.
      </p>
      {error ? (
        <div className="mt-4" role="alert">
          <p className="text-destructive">{error}</p>
          <Button
            type="button"
            variant="outline"
            disabled={reloading}
            onClick={async () => {
              setReloading(true);
              try {
                await taskQuery.refetch();
                setRevision((value) => value + 1);
                setError("");
              } catch (caught) {
                setError(graphQLErrorMessage(caught, "The task could not be reloaded."));
              } finally {
                setReloading(false);
              }
            }}
          >
            Reload task and discard edits
          </Button>
        </div>
      ) : null}
      {task.isDone ? (
        <p className="mt-4">Completed tasks and history are read-only.</p>
      ) : (
        <EditTaskForm
          key={`${taskId}:${revision}`}
          task={task}
          projects={projects.data?.projects.items ?? []}
          pending={loading || reloading}
          onSave={save}
        />
      )}
    </section>
  );
}
