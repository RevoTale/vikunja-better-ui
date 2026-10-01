import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { useRef, useState } from "react";
import {
  SessionDocument,
  SetTaskRelationDocument,
  type SetTaskRelationInput,
  TaskRelationshipsDocument,
} from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";

export function useTaskRelations(taskId: string) {
  const query = useQuery(TaskRelationshipsDocument, { variables: { taskId } });
  const session = useQuery(SessionDocument);
  const client = useApolloClient();
  const [mutate] = useMutation(SetTaskRelationDocument);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");

  async function change(input: Omit<SetTaskRelationInput, "csrfToken">) {
    const csrfToken = session.data?.session.csrfToken;
    if (inFlight.current) return false;
    if (!csrfToken) {
      setError("Sign in again before changing relationships.");
      return false;
    }
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const result = await mutate({ variables: { input: { ...input, csrfToken } } });
      if (!result.data?.setTaskRelation) throw new Error("Missing confirmation");
      await client.refetchQueries({ include: [TaskRelationshipsDocument] }).catch(() => {
        setError("Relationship saved. Refresh to update the displayed relationships.");
      });
      return true;
    } catch (caught) {
      setError(
        graphQLErrorMessage(
          caught,
          "Relationship could not be confirmed. Refresh before retrying.",
        ),
      );
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return { query, change, pending, error };
}
