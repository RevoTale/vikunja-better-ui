import { isValidLocalDate } from "@/features/tasks/local-date-time";

export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/today";
  }

  try {
    decodeURI(value);
    const url = new URL(value, "https://app.invalid");
    if (url.origin !== "https://app.invalid" || url.hash || !isApplicationPath(url.pathname)) {
      return "/today";
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return "/today";
  }
}

export function creationType(value: unknown): "one-time" | "recurring" | "job" {
  return value === "recurring" || value === "job" ? value : "one-time";
}

export function creationDate(value: unknown): string | undefined {
  return typeof value === "string" && isValidLocalDate(value) ? value : undefined;
}

export function creationProjectID(value: unknown): string | undefined {
  return typeof value === "string" && isPositiveID(value) ? value : undefined;
}

export function positiveID(value: string): string {
  if (!isPositiveID(value)) {
    throw new Error("Invalid task ID");
  }
  return value;
}

function isPositiveID(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

function isApplicationPath(pathname: string): boolean {
  if (/^\/(today|week|month|jobs|unscheduled|history)$/.test(pathname)) {
    return true;
  }
  return /^\/tasks\/(new|[1-9]\d*)(\/(extended|delete))?$/.test(pathname);
}
