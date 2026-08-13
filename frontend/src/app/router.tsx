import type { ApolloClient } from "@apollo/client";
import { createRouter, parseSearchWith, stringifySearchWith } from "@tanstack/react-router";

import { apolloClient } from "@/lib/apollo";
import { routeTree } from "@/routeTree.gen";

export type RouterContext = {
  apollo: ApolloClient;
};

export const router = createRouter({
  routeTree,
  context: { apollo: apolloClient },
  parseSearch: parseSearchWith((value) => value),
  stringifySearch: stringifySearchWith(JSON.stringify),
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
