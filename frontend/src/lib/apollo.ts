import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { sessionLink } from "@/features/auth/session-link";
import { taskCountRefreshLink } from "@/features/tasks/task-count-refresh";
import { uploadLink } from "./upload-link";

const httpLink = new HttpLink({
  uri: "/graphql",
  credentials: "same-origin",
});

export const apolloClient = new ApolloClient({
  link: sessionLink.concat(taskCountRefreshLink).concat(uploadLink).concat(httpLink),
  devtools: { enabled: false },
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
