import { CombinedGraphQLErrors } from "@apollo/client/errors";

export function graphQLErrorMessage(error: unknown, fallback: string): string {
  if (!CombinedGraphQLErrors.is(error)) return fallback;
  return error.errors.find((item) => item.message.trim())?.message.trim() ?? fallback;
}
