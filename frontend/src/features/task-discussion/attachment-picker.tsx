import { useQuery } from "@apollo/client/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type DiscussionAttachmentFragment,
  DiscussionAttachmentsDocument,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { mediaKind } from "./media-reference";

export function AttachmentPicker({
  taskId,
  onSelect,
}: {
  taskId: string;
  onSelect: (attachment: DiscussionAttachmentFragment) => void;
}) {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useQuery(DiscussionAttachmentsDocument, {
    variables: { taskId, page },
    fetchPolicy: "network-only",
  });
  return (
    <section className="space-y-2" aria-label="Task attachments">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={loading}
        onClick={() => {
          void refetch().catch(() => {});
        }}
      >
        Refresh attachments
      </Button>
      {loading ? <p role="status">Loading attachments…</p> : null}
      {error ? (
        <p role="alert">{graphQLErrorMessage(error, "Could not load task attachments.")}</p>
      ) : null}
      {!loading && !error && data?.taskAttachments.items.length === 0 ? (
        <p>No attachments yet.</p>
      ) : null}
      <ul>
        {data?.taskAttachments.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-all">
              {item.name} · {Math.ceil(item.sizeBytes / 1024)} KiB
            </span>
            {mediaKind(item.mimeType) ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => onSelect(item)}
              >
                Insert {item.name}
              </Button>
            ) : (
              <span className="text-xs">View this format in native Vikunja.</span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={loading || page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous attachments
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading || !data?.taskAttachments.hasMore}
          onClick={() => setPage(page + 1)}
        >
          Next attachments
        </Button>
      </div>
    </section>
  );
}
