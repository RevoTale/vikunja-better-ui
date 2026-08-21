import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteTaskDocument, SessionDocument, TaskDetailsDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import { taskDetailActionPolicy } from "./task-detail-action-policy";

export function DeleteTaskPage({ taskId, returnTo }: { taskId: string; returnTo: string }) {
  const navigate = useNavigate();
  const client = useApolloClient();
  const { data: sessionData, error: sessionError } = useQuery(SessionDocument);
  const { data, loading, error } = useQuery(TaskDetailsDocument, { variables: { id: taskId } });
  const [deleteTask, deleteState] = useMutation(DeleteTaskDocument);
  const [mutationError, setMutationError] = useState("");
  const task = data?.task;

  async function confirmDelete() {
    const csrfToken = sessionData?.session.csrfToken;
    if (!csrfToken) {
      setMutationError(
        graphQLErrorMessage(
          sessionError,
          "Your session is unavailable. Refresh the page and sign in again.",
        ),
      );
      return;
    }
    if (!task) return;
    setMutationError("");
    let deletedTaskID: string | undefined;
    try {
      deletedTaskID = (await deleteTask({ variables: { input: { csrfToken, taskId: task.id } } }))
        .data?.deleteTask.deletedTaskId;
    } catch (caught) {
      setMutationError(
        graphQLErrorMessage(caught, "The task was not deleted. Refresh it and try again."),
      );
      return;
    }
    if (!deletedTaskID) {
      setMutationError(
        "The deletion response was incomplete. Refresh before taking another action.",
      );
      return;
    }
    const cacheID = client.cache.identify({ __typename: "Task", id: deletedTaskID });
    if (cacheID) client.cache.evict({ id: cacheID });
    client.cache.gc();
    try {
      await navigate({ href: returnTo, replace: true });
    } catch {
      setMutationError("The task was deleted, but returning to the list failed.");
    }
  }

  if (loading && !data) return <p>Loading task…</p>;
  if (error || !task)
    return (
      <p role="alert" className="text-destructive">
        {graphQLErrorMessage(error, "Task could not be loaded.")}
      </p>
    );

  const canDelete = taskDetailActionPolicy(task).canDelete;
  return (
    <section className="mx-auto w-full max-w-xl">
      <Link
        to="/tasks/$taskId"
        params={{ taskId }}
        search={{ returnTo }}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4 px-0")}
      >
        <ArrowLeft /> Back
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{canDelete ? `Delete ${task.title}?` : "This task cannot be deleted"}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canDelete ? (
            <>
              <p className="text-sm text-muted-foreground">
                This permanently removes the active task from Vikunja. For recurring tasks, it stops
                the series; existing History entries remain.
              </p>
              {mutationError ? (
                <p className="mt-4 text-sm text-destructive" role="alert">
                  {mutationError}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={deleteState.loading}
                  onClick={confirmDelete}
                >
                  <Trash2 /> {deleteState.loading ? "Deleting…" : "Delete task"}
                </Button>
                <Link
                  to="/tasks/$taskId"
                  params={{ taskId }}
                  search={{ returnTo }}
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Cancel
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Completed tasks and History entries are read-only in this app.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
