import { creationDate, creationProjectID } from "@/app/route-search";
import { parseTaskPriority } from "./task-priority";

export function creationContext(pathname: string, search: string) {
  if (!/^\/(today|week|jobs|unscheduled|history)$/.test(pathname)) return {};
  const parameters = new URLSearchParams(search);
  const project = creationProjectID(parameters.get("project"));
  const label =
    pathname === "/today" || pathname === "/unscheduled"
      ? creationProjectID(parameters.get("label"))
      : undefined;
  const date = pathname === "/today" ? creationDate(parameters.get("date")) : undefined;
  const priority = ["/today", "/unscheduled", "/jobs"].includes(pathname)
    ? parseTaskPriority(parameters.get("priority"))
    : undefined;
  return {
    ...(project ? { project } : {}),
    ...(label ? { label } : {}),
    ...(date ? { date } : {}),
    ...(priority ? { priority } : {}),
  };
}

export function creationContextFromReturnTo(returnTo: string) {
  const url = new URL(returnTo, "https://app.invalid");
  return creationContext(url.pathname, url.search);
}
