import { useLazyQuery, useReactiveVar } from "@apollo/client/react";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useReducer, useRef, useState } from "react";
import { ActionableTaskCountDocument, ActiveWorkTaskCountDocument } from "@/graphql/graphql";
import { taskCountRevision } from "./task-count-refresh";

export function useNavigationCounts() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const revision = useReactiveVar(taskCountRevision);
  const [refreshVersion, refresh] = useReducer((value: number) => value + 1, 0);
  const version = `${pathname}:${revision}:${refreshVersion}`;
  const [loadToday, today] = useLazyQuery(ActionableTaskCountDocument, {
    fetchPolicy: "cache-and-network",
  });
  const [loadActive, active] = useLazyQuery(ActiveWorkTaskCountDocument, {
    fetchPolicy: "cache-and-network",
  });
  const todayLoading = useCountRefresh(loadToday, version);
  const activeLoading = useCountRefresh(loadActive, version);

  useEffect(() => {
    const refreshVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(refreshVisible, 60_000);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("focus", refreshVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("focus", refreshVisible);
    };
  }, []);

  return {
    "/today": { count: today.data?.actionableTaskCount, loading: todayLoading, error: today.error },
    "/active": {
      count: active.data?.activeWorkTaskCount,
      loading: activeLoading,
      error: active.error,
    },
  };
}

function useCountRefresh(execute: () => Promise<unknown>, version: string) {
  const [resolvedVersion, setResolvedVersion] = useState("");
  const inFlight = useRef(false);
  useEffect(() => {
    if (inFlight.current || resolvedVersion === version) return;
    inFlight.current = true;
    void execute()
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
        setResolvedVersion(version);
      });
  }, [execute, version, resolvedVersion]);
  return resolvedVersion !== version;
}
