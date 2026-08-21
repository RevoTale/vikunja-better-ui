import { createFileRoute, redirect } from "@tanstack/react-router";

import { safeReturnTo } from "@/app/route-search";
import { LoginPage } from "@/features/auth/login-page";
import { AuthSessionDocument } from "@/graphql/graphql";
import { setCSRFToken } from "@/lib/apollo";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: safeReturnTo(search.returnTo),
  }),
  beforeLoad: async ({ context, search }) => {
    const { data } = await context.apollo.query({
      query: AuthSessionDocument,
      fetchPolicy: "network-only",
    });
    setCSRFToken(data?.session.csrfToken);
    if (data?.session.authenticated) {
      throw redirect({ href: search.returnTo });
    }
  },
  component: LoginRoute,
});

function LoginRoute() {
  const { returnTo } = Route.useSearch();
  return <LoginPage returnTo={returnTo} />;
}
