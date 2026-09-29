import { useEffect, useState } from "react";

type Stop = { id: string; dialog: boolean };

export function useReplyNavigation(linkedCommentId?: string, ready = false) {
  const [trail, setTrail] = useState<Stop[]>([]);
  const current = trail.at(-1);
  useEffect(() => {
    if (!ready || !linkedCommentId) return;
    setTrail([
      { id: linkedCommentId, dialog: !document.getElementById(`comment-${linkedCommentId}`) },
    ]);
  }, [linkedCommentId, ready]);

  useEffect(() => {
    if (!current || current.dialog) return;
    const element = document.getElementById(`comment-${current.id}`);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: "start" });
  }, [current]);

  function follow(from: string, to: string) {
    setTrail((previous) => {
      const path = previous.at(-1)?.id === from ? previous : [{ id: from, dialog: false }];
      const visited = path.findIndex((stop) => stop.id === to);
      if (visited >= 0) return path.slice(0, visited + 1);
      return [
        ...path,
        {
          id: to,
          dialog: Boolean(path.at(-1)?.dialog || !document.getElementById(`comment-${to}`)),
        },
      ];
    });
  }

  return {
    current,
    depth: Math.max(0, trail.length - 1),
    follow,
    back: () => setTrail((previous) => previous.slice(0, -1)),
    close: () => setTrail((previous) => (previous[0]?.dialog ? [] : previous.slice(0, 1))),
    reset: () => setTrail([]),
  };
}
