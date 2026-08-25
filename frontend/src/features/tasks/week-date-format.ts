export function formatWeekRange(start: string, end: string): string {
  return `${formatLocalDate(start, { day: "numeric", month: "short", year: "numeric" })} – ${formatLocalDate(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function formatDayName(value: string): string {
  return formatLocalDate(value, { weekday: "long" });
}

export function formatDayDate(value: string): string {
  return formatLocalDate(value, { day: "numeric", month: "short" });
}

function formatLocalDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00Z`),
  );
}
