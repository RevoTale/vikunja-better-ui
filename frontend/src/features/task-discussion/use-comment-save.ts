import { useMutation } from "@apollo/client/react";
import { useRef, useState } from "react";
import {
  CreateDiscussionCommentDocument,
  UpdateDiscussionCommentDocument,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";

export function useCommentSave() {
  const [create, createState] = useMutation(CreateDiscussionCommentDocument);
  const [update, updateState] = useMutation(UpdateDiscussionCommentDocument);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const inFlight = useRef(false);

  async function save(
    input: { taskId: string; csrfToken: string; bodyHtml: string },
    commentId: string | undefined,
  ): Promise<boolean> {
    if (inFlight.current || uncertain) return false;
    inFlight.current = true;
    setError("");
    try {
      const confirmed = commentId
        ? (await update({ variables: { input: { ...input, commentId } } })).data?.updateTaskComment
        : (await create({ variables: { input } })).data?.createTaskComment;
      if (!confirmed) throw new Error("Missing confirmation");
      return true;
    } catch (caught) {
      setError(
        graphQLErrorMessage(
          caught,
          "Save could not be confirmed. Your text is preserved. Refresh the discussion before retrying.",
        ),
      );
      setUncertain(true);
      return false;
    } finally {
      inFlight.current = false;
    }
  }

  return {
    save,
    error,
    uncertain,
    pending: createState.loading || updateState.loading,
    allowRetry: () => {
      setUncertain(false);
      setError("");
    },
  };
}
