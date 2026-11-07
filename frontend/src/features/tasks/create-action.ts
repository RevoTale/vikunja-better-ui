export type CreateAction = {
  label: "New timed session" | "New task" | "New recurring task";
  type: "job" | "one-time" | "recurring";
};

export function createActionForPath(pathname: string): CreateAction {
  if (pathname === "/recurring") return { label: "New recurring task", type: "recurring" };
  if (pathname === "/jobs") {
    return { label: "New timed session", type: "job" };
  }

  return { label: "New task", type: "one-time" };
}
