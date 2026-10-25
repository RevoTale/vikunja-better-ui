import type { ApolloClient } from "@apollo/client";
import {
  createRouter,
  parseSearchWith,
  stringifySearchWith,
  useRouter,
} from "@tanstack/react-router";

import { LoadFailure } from "@/components/load-failure";
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
  defaultErrorComponent: RouteLoadFailure,
  scrollRestoration: true,
});

function RouteLoadFailure() {
  const appRouter = useRouter();
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <div className="w-full max-w-md space-y-3 text-center">
        <h1 className="font-serif text-2xl font-semibold">This page could not be loaded</h1>
        <LoadFailure onRetry={() => void appRouter.invalidate()}>
          Try loading it again. If the problem continues, reload the app.
        </LoadFailure>
      </div>
    </main>
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
