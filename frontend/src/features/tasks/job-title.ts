import { composeLocalDateTime, currentLocalDate, type LocalDateTimeParts } from "./local-date-time";

export function defaultJobStart(): LocalDateTimeParts {
  return { date: currentLocalDate(), time: "09:00" };
}

export function jobTitlePlaceholder(parts: LocalDateTimeParts): string {
  const startLocal = composeLocalDateTime(parts);
  return startLocal ? `Job ${startLocal.replace("T", " ")}` : "";
}
