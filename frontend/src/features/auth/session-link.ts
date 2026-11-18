import { type ApolloClient, ApolloLink } from "@apollo/client";
import { tap } from "rxjs";
import { SessionDocument } from "@/graphql/graphql";
import { sessionChangedElsewhere } from "./session-change";

// Each document and Apollo cache belongs to a single session. Renewal keeps its CSRF value.
let csrfToken: string | null | undefined;
let checkingProfile = false;

export function currentCSRFToken() {
  return csrfToken;
}

function recheckProfile(client: ApolloClient) {
  if (checkingProfile) return;
  checkingProfile = true;
  void client
    .query({
      query: SessionDocument,
      fetchPolicy: "no-cache",
      context: { queryDeduplication: false },
    })
    .catch(() => {
      // A temporary network failure leaves the current session available for retry.
    })
    .finally(() => {
      checkingProfile = false;
    });
}

function observeSession(session: unknown) {
  if (!session || typeof session !== "object" || !("csrfToken" in session)) return;
  const next = session.csrfToken;
  if (typeof next !== "string" && next !== null) return;
  if (csrfToken !== undefined && next !== csrfToken) sessionChangedElsewhere();
  else csrfToken = next;
}

export const sessionLink = new ApolloLink((operation, forward) => {
  const sentToken = csrfToken;
  if (sentToken) {
    operation.setContext((context) => ({
      headers: { ...context["headers"], "X-CSRF-Token": sentToken },
    }));
  }
  if (operation.operationName === "Login") return forward(operation);

  const readsSession =
    operation.operationName === "AuthSession" || operation.operationName === "Session";
  return forward(operation).pipe(
    tap((result) => {
      const unauthenticated = result.errors?.some(
        (error) => error.extensions?.["code"] === "UNAUTHENTICATED",
      );
      if (unauthenticated && sentToken && sentToken === csrfToken) {
        // Re-read the cookie now. A delayed task response can belong to the account that just signed out.
        if (readsSession) sessionChangedElsewhere();
        else recheckProfile(operation.client);
      } else if (readsSession) {
        observeSession(result.data?.["session"]);
      }
    }),
  );
});
