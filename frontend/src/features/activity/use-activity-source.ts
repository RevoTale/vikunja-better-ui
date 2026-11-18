import { useQuery } from "@apollo/client/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AuthSessionDocument,
  PublicActivityDocument,
  PublicAllTimeActivityDocument,
} from "@/graphql/graphql";
import {
  type ActivityValueSource,
  type ActivityView,
  type AllTimeActivityView,
  allTimeActivityView,
  visibleActivity,
} from "./activity-view-model";
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
  denied: boolean;
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
  const selected = visibleActivity(
    publicValue,
    current.data?.publicActivity,
    authenticated,
    current,
  );
  return {
    ...selected,
    loading: authenticated ? current.loading && !selected.value : publicLoading || session.loading,
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
  const selected = visibleActivity(
    publicValue,
    current.data?.publicAllTimeActivity,
    authenticated,
    current,
  );
  const value = useMemo(() => allTimeActivityView(selected.value), [selected.value]);
  const reload = useCallback(() => {
    void session.refetch().catch(() => undefined);
    if (authenticated) void current.refetch().catch(() => undefined);
    else setPublicReload((count) => count + 1);
  }, [authenticated, current.refetch, session.refetch]);
  return {
    ...selected,
    value,
    loading: authenticated ? current.loading && !selected.value : publicLoading || session.loading,
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
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    requestPublicSnapshot(path, parser, (input, init) =>
      fetch(input, { ...init, signal: controller.signal }),
    ).then(
      (snapshot) => {
        if (controller.signal.aborted) return;
        handledReload.current = reload;
        setLoading(false);
        setValue(snapshot);
      },
      () => {
        if (controller.signal.aborted) return;
        handledReload.current = reload;
        setLoading(false);
        setError(true);
      },
    );
    return () => controller.abort();
  }, [authenticated, parser, path, reload, sessionLoading, setError, setLoading, setValue, value]);
}
