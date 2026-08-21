import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/features/auth/app-shell";
import { AuthSessionDocument } from "@/graphql/graphql";
import { setCSRFToken } from "@/lib/apollo";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    const { data } = await context.apollo.query({
      query: AuthSessionDocument,
      fetchPolicy: "network-only",
    });
    setCSRFToken(data?.session.csrfToken);
    if (!data?.session.authenticated) {
      throw redirect({
        to: "/login",
        search: { returnTo: `${location.pathname}${location.searchStr}` },
      });
    }
  },
  component: AppShell,
});
