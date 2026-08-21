import { useEffect, useRef } from "react";

import { toast } from "@/components/ui/toast";
import { scheduleDelayedFeedback } from "./delayed-feedback";

const refreshFeedbackDelay = 1_000;

export function useTaskRefreshFeedback({
  refreshing,
  errorMessage,
}: {
  refreshing: boolean;
  errorMessage: string | undefined;
}) {
  const toastID = useRef<string>(undefined);

  useEffect(() => {
    if (errorMessage) {
      if (toastID.current) {
        toast.update(toastID.current, {
          type: "error",
          title: "Tasks could not be refreshed",
          description: errorMessage,
          priority: "high",
          timeout: 5_000,
        });
      } else {
        toastID.current = toast.add({
          type: "error",
          title: "Tasks could not be refreshed",
          description: errorMessage,
          priority: "high",
          timeout: 5_000,
        });
      }
      return;
    }

    if (!refreshing) {
      if (toastID.current) toast.close(toastID.current);
      toastID.current = undefined;
      return;
    }

    if (toastID.current) {
      toast.close(toastID.current);
      toastID.current = undefined;
    }

    return scheduleDelayedFeedback(() => {
      toastID.current = toast.add({
        type: "loading",
        title: "Refreshing tasks…",
        description: "Showing the latest loaded tasks while new data arrives.",
        timeout: 0,
      });
    }, refreshFeedbackDelay);
  }, [errorMessage, refreshing]);

  useEffect(
    () => () => {
      if (toastID.current) toast.close(toastID.current);
    },
    [],
  );
}
