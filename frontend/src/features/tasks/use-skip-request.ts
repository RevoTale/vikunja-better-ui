import { useMutation } from "@apollo/client/react";
import { SkipRecurringTaskDocument, type SkipRecurringTaskInput } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";

export function useSkipRequest(
  onChanged: () => Promise<unknown>,
  setError: (message: string) => void,
) {
  const [skip] = useMutation(SkipRecurringTaskDocument);
  return async (input: SkipRecurringTaskInput) => {
    try {
      const payload = (await skip({ variables: { input } })).data?.skipRecurringTask;
      if (payload) return payload;
      setError("The Skip response was incomplete. Reload the page before taking another action.");
    } catch (caught) {
      setError(
        graphQLErrorMessage(
          caught,
          "Skip could not be confirmed. The task was refreshed before you try again.",
        ),
      );
    }
    await onChanged().catch(() => undefined);
    return undefined;
  };
}
