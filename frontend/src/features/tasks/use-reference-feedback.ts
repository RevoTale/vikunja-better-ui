import { useApolloClient } from "@apollo/client/react";
import { toast } from "@/components/ui/toast";
import {
  type ReferenceLinkingResultFragment,
  RepairTaskReferencesDocument,
  TaskRelationshipsDocument,
} from "@/graphql/graphql";

export function useReferenceFeedback() {
  const client = useApolloClient();
  function refreshRelationships() {
    void client.refetchQueries({ include: [TaskRelationshipsDocument] }).catch(() => {
      toast.add({
        type: "warning",
        title: "Saved; refresh relationships",
        description:
          "The content and confirmed links were saved. The latest relationships could not be loaded.",
      });
    });
  }
  return (
    initial: ReferenceLinkingResultFragment | null | undefined,
    csrfToken: string | null | undefined,
  ) => {
    if (!initial) return;
    if (initial.linkedCount > 0) refreshRelationships();
    if (!initial.limited && initial.failedTargetIds.length === 0) return;
    let result = initial;
    let pending = false;
    const action = () =>
      csrfToken && result.failedTargetIds.length
        ? {
            children: "Retry links",
            onClick: () => {
              void repair();
            },
          }
        : undefined;
    const id = toast.add({
      type: "warning",
      title: "Saved; some task links need attention",
      description: referenceMessage(result),
      timeout: 0,
      actionProps: action(),
    });
    async function repair() {
      if (pending || !csrfToken) return;
      pending = true;
      toast.update(id, { actionProps: { children: "Retrying links…", disabled: true } });
      try {
        const response = await client.mutate({
          mutation: RepairTaskReferencesDocument,
          variables: {
            input: {
              csrfToken,
              taskId: result.taskId,
              commentId: result.commentId,
              targetIds: result.failedTargetIds,
            },
          },
        });
        if (!response.data) throw new Error("Missing repair confirmation");
        result = { ...response.data.repairTaskReferences, limited: result.limited };
        refreshRelationships();
        showReferenceResult(id, result);
      } catch {
        toast.update(id, {
          description:
            "The saved content is unchanged. Links could not be repaired; check access and whether the references still exist.",
        });
      } finally {
        pending = false;
        toast.update(id, { actionProps: action() });
      }
    }
  };
}

function showReferenceResult(id: string, result: ReferenceLinkingResultFragment) {
  const warning = result.failedTargetIds.length > 0 || result.limited;
  toast.update(id, {
    type: warning ? "warning" : "success",
    title: warning ? "Saved; task links need attention" : "Task links added",
    description: referenceMessage(result),
  });
}

function referenceMessage(result: ReferenceLinkingResultFragment) {
  return [
    result.failedTargetIds.length
      ? `${result.failedTargetIds.length} task links could not be confirmed. Retry links only; do not submit the content again.`
      : "The saved content is unchanged.",
    result.limited
      ? "Automatic linking is limited to 20 targets and 512 KiB of content. Review remaining links manually."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
