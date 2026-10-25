import { createFileRoute, redirect } from "@tanstack/react-router";
import { PublicLandingPage } from "@/features/activity/public-landing-page";
import { AuthSessionDocument } from "@/graphql/graphql";
import { setCSRFToken } from "@/lib/apollo";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const { data } = await context.apollo
      .query({ query: AuthSessionDocument, fetchPolicy: "network-only" })
      .catch(() => ({ data: undefined }));
    setCSRFToken(data?.session.csrfToken);
    if (data?.session.authenticated) {
      throw redirect({ to: "/today", search: { project: "all", page: 1 } });
    }
  },
  component: PublicLandingPage,
});
