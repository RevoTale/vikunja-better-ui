export function displayTime(
  value: Date,
  timeZone: string | undefined,
  use12HourTime = false,
  withSeconds = false,
): string {
  return new Intl.DateTimeFormat("en-GB", {
    ...(timeZone ? { timeZone } : {}),
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" as const } : {}),
    hourCycle: use12HourTime ? "h12" : "h23",
  })
    .format(value)
    .toUpperCase();
}

export function inputTime(value: string, use12HourTime: boolean): string {
  if (!value || !use12HourTime) return value;
  const hour = Number(value.slice(0, 2)) % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${value.slice(3)}`;
}

export function parseTime(
  value: string,
  use12HourTime: boolean,
  period: "AM" | "PM",
): string | null {
  const parts = value.match(/^(\d{1,2}):([0-5]\d)$/) ?? value.match(/^(\d{2})([0-5]\d)$/);
  if (!parts) return null;
  let hour = Number(parts[1]);
  if (use12HourTime) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (period === "PM" ? 12 : 0);
  } else if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${parts[2]}`;
}

export function displayLocalTime(value: string | undefined, use12HourTime: boolean): string {
  if (!value) return "";
  const time = value.slice(11);
  if (!time) return value;
  const period = Number(time.slice(0, 2)) >= 12 ? "PM" : "AM";
  return `${value.slice(0, 10)} ${inputTime(time, use12HourTime)}${use12HourTime ? ` ${period}` : ""}`;
}

export function displayTimestamp(value: string, use12HourTime: boolean, timeZone?: string): string {
  const date = new Date(value);
  const calendarDate = date.toLocaleDateString(undefined, timeZone ? { timeZone } : {});
  return `${calendarDate}, ${displayTime(date, timeZone, use12HourTime, true)}`;
}
