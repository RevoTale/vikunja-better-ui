import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { SetContextLink } from "@apollo/client/link/context";

let csrfToken: string | undefined;

const csrfLink = new SetContextLink((previousContext) => ({
  headers: {
    ...previousContext["headers"],
    ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
  },
}));

const httpLink = new HttpLink({
  uri: "/graphql",
  credentials: "same-origin",
});

export const apolloClient = new ApolloClient({
  link: csrfLink.concat(httpLink),
  defaultOptions: {
    watchQuery: { fetchPolicy: "cache-and-network" },
  },
  cache: new InMemoryCache({
    typePolicies: {
      Task: { keyFields: ["id"] },
      Project: { keyFields: ["id"] },
      Label: { keyFields: ["id"] },
    },
  }),
});

export function setCSRFToken(token: string | null | undefined): void {
  csrfToken = token ?? undefined;
}
