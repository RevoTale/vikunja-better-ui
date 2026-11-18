import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { parse } from "graphql";
import { of, Subject } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthSessionDocument, UploadDiscussionMediaDocument } from "@/graphql/graphql";
import { uploadLink } from "@/lib/upload-link";
import { graphQLErrorMessage, mutationOutcomeUncertain } from "@/lib/user-error";
import { sessionChangedElsewhere } from "./session-change";
import { sessionLink } from "./session-link";

vi.mock("./session-change", () => ({ sessionChangedElsewhere: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function denied(code: string) {
  return { errors: [{ message: "Request rejected", extensions: { code } }] };
}

function session(csrfToken: string) {
  return {
    data: {
      session: {
        csrfToken,
        authenticated: true,
        use12HourTime: false,
        expiresAt: null,
        vikunjaUser: null,
      },
    },
  };
}

async function openEditor(errorCode: string) {
  const profile = new Subject<ApolloLink.Result>();
  const privateRequest = parse('query Editor { task(id: "1") { id } }');
  const requests: string[] = [];
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: sessionLink.concat(uploadLink).concat(
      new ApolloLink((op) => {
        requests.push(op.operationName ?? "");
        if (op.operationName === "AuthSession") return of(session("first-session"));
        if (op.operationName === "Session") return profile;
        return of(denied(errorCode));
      }),
    ),
  });
  await client.query({ query: AuthSessionDocument, fetchPolicy: "no-cache" });
  const read = () =>
    client.query({ query: privateRequest, fetchPolicy: "no-cache", errorPolicy: "all" });
  return { client, read, profile, requests };
}

describe("private operation session failures", () => {
  it("rechecks the active cookie once when several reads fail and discards a confirmed revoked session", async () => {
    const { client, read, profile, requests } = await openEditor("UNAUTHENTICATED");
    await read();
    await read();
    expect(requests).toEqual(["AuthSession", "Editor", "Session", "Editor"]);
    expect(sessionChangedElsewhere).not.toHaveBeenCalled();
    profile.next(denied("UNAUTHENTICATED"));
    profile.complete();
    expect(sessionChangedElsewhere).toHaveBeenCalledOnce();
    client.stop();
  });

  it("keeps the current session after a late error if its profile is still valid", async () => {
    const { client, read, profile } = await openEditor("UNAUTHENTICATED");
    await read();
    profile.next(session("first-session"));
    profile.complete();
    expect(sessionChangedElsewhere).not.toHaveBeenCalled();
    client.stop();
  });

  it.each(["FORBIDDEN", "UPSTREAM_UNAVAILABLE"])("leaves a session intact on %s", async (code) => {
    const { client, read, requests } = await openEditor(code);
    await read();
    expect(requests).toEqual(["AuthSession", "Editor"]);
    expect(sessionChangedElsewhere).not.toHaveBeenCalled();
    client.stop();
  });
});

describe("multipart upload rejection", () => {
  it.each([
    { status: 401, code: "UNAUTHENTICATED", message: "Sign in to upload this file." },
    {
      status: 403,
      code: "FORBIDDEN",
      message: "Upload was refused. Refresh the page and try again.",
    },
    {
      status: 411,
      code: "VALIDATION_FAILED",
      message: "The server requires the file size to accept this upload.",
    },
    {
      status: 413,
      code: "VALIDATION_FAILED",
      message: "This file exceeds the server’s upload limit. Choose a smaller file.",
    },
    {
      status: 415,
      code: "VALIDATION_FAILED",
      message: "The server did not accept the upload request format.",
    },
    { status: 503, code: undefined, message: "Unknown upload result" },
  ])("handles HTTP $status without replaying the upload", async ({ status, message, code }) => {
    const { client, profile, requests } = await openEditor("UNAUTHENTICATED");
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status }));
    vi.stubGlobal("fetch", fetch);
    const result = await client.mutate({
      mutation: UploadDiscussionMediaDocument,
      variables: {
        input: { taskId: "1", csrfToken: "first-session", file: new File(["abc"], "file.png") },
      },
      errorPolicy: "all",
    });
    expect(graphQLErrorMessage(result.error, "Unknown upload result")).toBe(message);
    const errors = CombinedGraphQLErrors.is(result.error) ? result.error.errors : [];
    expect(errors[0]?.extensions?.["code"]).toBe(code);
    expect(mutationOutcomeUncertain(result.error)).toBe(code === undefined);
    expect(sessionChangedElsewhere).not.toHaveBeenCalled();
    if (status === 401) {
      expect(requests).toEqual(["AuthSession", "Session"]);
      profile.next(denied("UNAUTHENTICATED"));
      profile.complete();
      expect(sessionChangedElsewhere).toHaveBeenCalledOnce();
    } else {
      expect(requests).toEqual(["AuthSession"]);
    }
    expect(fetch).toHaveBeenCalledOnce();
    client.stop();
  });
});
