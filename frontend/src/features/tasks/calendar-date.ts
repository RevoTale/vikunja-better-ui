import { isValidLocalDate } from "./local-date-time";

export function calendarDateFromISO(value: string): Date | undefined {
  if (!isValidLocalDate(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day, 12));
}

export function isoDateFromCalendarDate(value: Date | undefined): string {
  if (!value || Number.isNaN(value.getTime())) return "";
  return [
    String(value.getUTCFullYear()).padStart(4, "0"),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
