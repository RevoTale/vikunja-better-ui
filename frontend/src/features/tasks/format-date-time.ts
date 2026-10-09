import { displayTime } from "@/lib/time-format";

export function formatDateTime(
  value: string,
  withTime: boolean,
  timeZone: string,
  use12HourTime = false,
): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  const parts = new Intl.DateTimeFormat("en-GB", options).formatToParts(new Date(value));
  const date = `${part(parts, "day")}-${part(parts, "month")}-${part(parts, "year")}`;
  return withTime ? `${date} - ${displayTime(new Date(value), timeZone, use12HourTime)}` : date;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? "";
}
