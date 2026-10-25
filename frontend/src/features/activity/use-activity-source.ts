import { useQuery } from "@apollo/client/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AuthSessionDocument,
  PublicActivityDocument,
  PublicAllTimeActivityDocument,
  type PublicAllTimeActivityQuery,
} from "@/graphql/graphql";
import type { ActivityValueSource, ActivityView, AllTimeActivityView } from "./activity-view-model";
import {
  type ActivitySnapshot,
  type AllTimeActivitySnapshot,
  parseActivitySnapshot,
  parseAllTimeActivitySnapshot,
  readPublicBootstrap,
  requestPublicSnapshot,
} from "./public-activity-client";

export type ActivitySource<T = ActivityView> = {
  value: T | null;
  valueSource: ActivityValueSource | null;
  loading: boolean;
  updating: boolean;
  error: boolean;
  authenticated: boolean;
  reload: () => void;
};

export function useActivitySource(): ActivitySource<ActivityView> {
  const [publicValue, setPublicValue] = useState<ActivitySnapshot | null>(() =>
    readPublicBootstrap("public-activity-bootstrap", parseActivitySnapshot),
  );
  const [publicLoading, setPublicLoading] = useState(publicValue === null);
  const [publicError, setPublicError] = useState(false);
  const [publicReload, setPublicReload] = useState(0);
  const session = useQuery(AuthSessionDocument);
  const authenticated = session.data?.session.authenticated === true;
  const current = useQuery(PublicActivityDocument, {
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
    skip: !authenticated,
  });
  usePublicSnapshotRequest(
    authenticated,
    session.loading,
    publicValue,
    publicReload,
    "/public/v1/activity",
    parseActivitySnapshot,
    setPublicValue,
    setPublicLoading,
    setPublicError,
  );
  const reload = useCallback(() => {
    void session.refetch().catch(() => undefined);
    if (authenticated) void current.refetch().catch(() => undefined);
    else setPublicReload((value) => value + 1);
  }, [authenticated, current.refetch, session.refetch]);
  const authenticatedValue = current.data?.publicActivity ?? null;
  const value = authenticatedValue ?? publicValue;
  return {
    value,
    valueSource: authenticatedValue ? "private" : publicValue ? "public" : null,
    loading: authenticated ? current.loading && !publicValue : publicLoading || session.loading,
    updating: authenticated && current.loading && value !== null,
    error: authenticated ? Boolean(current.error) : publicError || Boolean(session.error),
    authenticated,
    reload,
  };
}

export function useAllTimeActivitySource(): ActivitySource<AllTimeActivityView> {
  const [publicValue, setPublicValue] = useState<AllTimeActivitySnapshot | null>(() =>
    readPublicBootstrap("public-all-time-activity-bootstrap", parseAllTimeActivitySnapshot),
  );
  const [publicLoading, setPublicLoading] = useState(publicValue === null);
  const [publicError, setPublicError] = useState(false);
  const [publicReload, setPublicReload] = useState(0);
  const session = useQuery(AuthSessionDocument);
  const authenticated = session.data?.session.authenticated === true;
  const current = useQuery(PublicAllTimeActivityDocument, {
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
    skip: !authenticated,
  });
  usePublicSnapshotRequest(
    authenticated,
    session.loading,
    publicValue,
    publicReload,
    "/public/v1/all-time-activity",
    parseAllTimeActivitySnapshot,
    setPublicValue,
    setPublicLoading,
    setPublicError,
  );
  const authenticatedValue = current.data?.publicAllTimeActivity;
  const value = authenticatedValue
    ? allTimeGraphQLView(authenticatedValue)
    : publicAllTimeView(publicValue);
  const reload = useCallback(() => {
    void session.refetch().catch(() => undefined);
    if (authenticated) void current.refetch().catch(() => undefined);
    else setPublicReload((count) => count + 1);
  }, [authenticated, current.refetch, session.refetch]);
  return {
    value,
    valueSource: authenticatedValue ? "private" : publicValue ? "public" : null,
    loading: authenticated ? current.loading && !publicValue : publicLoading || session.loading,
    updating: authenticated && current.loading && value !== null,
    error: authenticated ? Boolean(current.error) : publicError || Boolean(session.error),
    authenticated,
    reload,
  };
}

function usePublicSnapshotRequest<T>(
  authenticated: boolean,
  sessionLoading: boolean,
  value: T | null,
  reload: number,
  path: string,
  parser: (value: unknown) => T,
  setValue: (value: T) => void,
  setLoading: (value: boolean) => void,
  setError: (value: boolean) => void,
) {
  const handledReload = useRef(-1);
  useEffect(() => {
    if (
      authenticated ||
      sessionLoading ||
      (value && reload === 0) ||
      handledReload.current === reload
    )
      return;
    handledReload.current = reload;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    requestPublicSnapshot(path, parser, (input, init) =>
      fetch(input, { ...init, signal: controller.signal }),
    )
      .then(setValue)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [authenticated, parser, path, reload, sessionLoading, setError, setLoading, setValue, value]);
}

function publicAllTimeView(activity: AllTimeActivitySnapshot | null): AllTimeActivityView | null {
  if (!activity) return null;
  return { ...activity, weeks: activity.weeks.map((week) => ({ ...week, priorities: [] })) };
}

function allTimeGraphQLView(
  activity: NonNullable<PublicAllTimeActivityQuery["publicAllTimeActivity"]>,
): AllTimeActivityView {
  const weeks = activity.weeks.map((week) => {
    const totals = week.priorities.reduce(
      (sum, item) => ({
        count: sum.count + item.count,
        completedWithDeadline: sum.completedWithDeadline + item.completedWithDeadline,
        completedOnTime: sum.completedOnTime + item.completedOnTime,
      }),
      { count: 0, completedWithDeadline: 0, completedOnTime: 0 },
    );
    return { ...week, ...totals };
  });
  return { ...activity, weeks };
}
