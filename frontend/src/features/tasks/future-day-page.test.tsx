import { useQuery } from "@apollo/client/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { DayDocument, ProjectsDocument, type SessionQuery } from "@/graphql/graphql";
import { parseDaySearch } from "./day-search";
import { FutureDayPage } from "./future-day-page";
import { useTaskListActions } from "./use-task-list-actions";

vi.mock("@apollo/client/react", () => ({
  useQuery: vi.fn(() => ({ loading: true, refetch: vi.fn() })),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/today", searchStr: "?date=2026-11-01" }),
}));
vi.mock("./task-list-header", () => ({ TaskListHeader: () => null }));
vi.mock("./use-task-list-actions", () => ({ useTaskListActions: vi.fn(() => ({})) }));

it("reuses the parent session for day actions without querying its metadata", () => {
  const session: SessionQuery = {
    session: {
      authenticated: true,
      csrfToken: "parent-session-csrf",
      expiresAt: null,
      use12HourTime: false,
      vikunjaUser: null,
    },
  };
  renderToStaticMarkup(
    <FutureDayPage
      search={parseDaySearch({})}
      date="2026-11-01"
      setSearch={vi.fn()}
      navigation={null}
      session={session}
      sessionError={undefined}
    />,
  );

  expect(vi.mocked(useQuery).mock.calls.map(([document]) => document)).toEqual([
    ProjectsDocument,
    DayDocument,
  ]);
  expect(useTaskListActions).toHaveBeenCalledWith("parent-session-csrf", expect.any(Function));
});
