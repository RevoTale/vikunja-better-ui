import { composeLocalDateTime, currentLocalDate, type LocalDateTimeParts } from "./local-date-time";

export function defaultJobStart(): LocalDateTimeParts {
  return { date: currentLocalDate(), time: "09:00" };
}

export function jobTitlePlaceholder(parts: LocalDateTimeParts): string {
  const startLocal = composeLocalDateTime(parts);
  return startLocal
    ? `Job ${parts.date.slice(8, 10)}-${parts.date.slice(5, 7)}-${parts.date.slice(0, 4)} - ${parts.time}`
    : "";
}
