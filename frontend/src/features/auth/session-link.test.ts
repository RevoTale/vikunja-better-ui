import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { parse } from "graphql";
import { of, Subject } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthSessionDocument } from "@/graphql/graphql";
import { sessionChangedElsewhere } from "./session-change";
import { sessionLink } from "./session-link";

vi.mock("./session-change", () => ({ sessionChangedElsewhere: vi.fn() }));
afterEach(() => vi.clearAllMocks());

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
    link: sessionLink.concat(
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
