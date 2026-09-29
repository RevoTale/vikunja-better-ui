import { useLazyQuery, useReactiveVar } from "@apollo/client/react";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useReducer, useRef, useState } from "react";
import { ActionableTaskCountDocument } from "@/graphql/graphql";
import { taskCountRevision } from "./task-count-refresh";

export function useActionableCount() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const revision = useReactiveVar(taskCountRevision);
  const [refreshVersion, refresh] = useReducer((value: number) => value + 1, 0);
  const version = `${pathname}:${revision}:${refreshVersion}`;
  const [resolvedVersion, setResolvedVersion] = useState("");
  const inFlight = useRef(false);
  const [execute, { data, error }] = useLazyQuery(ActionableTaskCountDocument, {
    fetchPolicy: "network-only",
  });

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

  return { count: data?.actionableTaskCount, loading: resolvedVersion !== version, error };
}
