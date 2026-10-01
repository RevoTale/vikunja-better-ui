import { CombinedGraphQLErrors } from "@apollo/client/errors";

// Only explicit rejection codes prove that creation did not happen.
export function subtaskCreationUncertain(error: unknown): boolean {
  if (!CombinedGraphQLErrors.is(error)) return true;
  const rejected = new Set(["VALIDATION_FAILED", "FORBIDDEN", "UNAUTHENTICATED", "CSRF_INVALID"]);
  return (
    error.errors.length === 0 ||
    error.errors.some((entry) => !rejected.has(String(entry.extensions?.["code"])))
  );
}
