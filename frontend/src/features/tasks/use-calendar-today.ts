import { useSyncExternalStore } from "react";
import { currentDateInTimeZone } from "./local-date-time";

function subscribe(refresh: () => void) {
  const refreshVisible = () => {
    if (document.visibilityState === "visible") refresh();
  };
  const interval = window.setInterval(refreshVisible, 60_000);
  document.addEventListener("visibilitychange", refreshVisible);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", refreshVisible);
  };
}

export function useCalendarToday(timezone: string | undefined) {
  return useSyncExternalStore(subscribe, () =>
    timezone ? currentDateInTimeZone(timezone) : undefined,
  );
}
