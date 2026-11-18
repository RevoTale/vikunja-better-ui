import { CombinedGraphQLErrors } from "@apollo/client/errors";

export function graphQLErrorMessage(error: unknown, fallback: string): string {
  if (!CombinedGraphQLErrors.is(error)) return fallback;
  return error.errors.find((item) => item.message.trim())?.message.trim() ?? fallback;
}

const rejectionCodes = new Set([
  "VALIDATION_FAILED",
  "FORBIDDEN",
  "UNAUTHENTICATED",
  "CSRF_INVALID",
]);

// Only an explicit rejection guarantees that the write did not happen.
export function mutationOutcomeUncertain(error: unknown): boolean {
  if (!CombinedGraphQLErrors.is(error)) return true;
  return (
    error.errors.length === 0 ||
    error.errors.some((entry) => !rejectionCodes.has(String(entry.extensions?.["code"])))
  );
}
