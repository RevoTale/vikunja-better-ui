export function formatDateTime(value: string, withTime: boolean, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
  };
  const parts = new Intl.DateTimeFormat("en-GB", options).formatToParts(new Date(value));
  const date = `${part(parts, "day")}-${part(parts, "month")}-${part(parts, "year")}`;
  return withTime ? `${date} - ${part(parts, "hour")}:${part(parts, "minute")}` : date;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? "";
}
