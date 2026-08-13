export type CreateAction = {
  label: "New job" | "New task";
  type: "job" | "one-time";
};

export function createActionForPath(pathname: string): CreateAction {
  if (pathname === "/jobs") {
    return { label: "New job", type: "job" };
  }

  return { label: "New task", type: "one-time" };
}
