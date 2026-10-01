import { useQuery } from "@apollo/client/react";
import { useState } from "react";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RelationCandidatesDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";

export function RelationSearch({
  taskId,
  excluded,
  pending,
  error,
  onSelect,
  onClose,
}: {
  taskId: string;
  excluded: Set<string>;
  pending: boolean;
  error: string;
  onSelect: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery(RelationCandidatesDocument, { variables: { taskId, search, page } });
  const result = query.data?.relationCandidates;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>Link an existing task</DialogTitle>
        <DialogDescription>
          Search by title or task ID. Task properties stay unchanged.
        </DialogDescription>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (page === 1 && search === text.trim()) void query.refetch();
            setPage(1);
            setSearch(text.trim());
          }}
        >
          <Input
            aria-label="Find task"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <Button type="submit" disabled={pending}>
            Search
          </Button>
        </form>
        {error || query.error ? (
          <p role="alert" className="text-destructive">
            {error || graphQLErrorMessage(query.error, "Tasks could not be loaded.")}
          </p>
        ) : null}
        {query.loading ? (
          <div role="status">
            <span className="sr-only">Loading task candidates</span>
            <LoadingPlaceholder className="h-32 w-full" />
          </div>
        ) : (
          <ul className="max-h-64 overflow-auto" aria-label="Task candidates">
            {result?.items
              .filter((task) => !excluded.has(task.id))
              .map((task) => (
                <li key={task.id}>
                  <Button
                    variant="ghost"
                    className="h-auto min-h-11 w-full justify-start whitespace-normal text-left"
                    disabled={pending}
                    onClick={() => void onSelect(task.id)}
                  >
                    #{task.id} {task.title}
                  </Button>
                </li>
              ))}
            {result?.items.every((task) => excluded.has(task.id)) ? (
              <li className="py-2 text-muted-foreground">No matching tasks on this page.</li>
            ) : null}
          </ul>
        )}
        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            disabled={page === 1 || pending || query.loading}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={!result?.hasMore || pending || query.loading}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
