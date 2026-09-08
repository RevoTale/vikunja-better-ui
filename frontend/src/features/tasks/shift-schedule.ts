import { isValidLocalDate, isValidLocalTime } from "./local-date-time";

export type ScheduleFields = { start?: string; end?: string; due?: string };
export type ScheduleTarget = keyof ScheduleFields | "all";

export function formatLocalInstant(instant: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function localInstant(value: string, timezone: string): number {
  if (
    !isValidLocalDate(value.slice(0, 10)) ||
    !isValidLocalTime(value.slice(11)) ||
    value.length !== 16
  ) {
    throw new Error("Choose a valid date and time first.");
  }
  const wall = Date.parse(`${value}:00Z`);
  const candidates = new Set<number>();
  // Discover the offsets on both sides of a nearby timezone transition.
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = wall + hours * 3600000;
    const offset = Date.parse(`${formatLocalInstant(sample, timezone)}:00Z`) - sample;
    const candidate = wall - offset;
    if (formatLocalInstant(candidate, timezone) === value) candidates.add(candidate);
  }
  const candidate = candidates.values().next().value;
  if (candidates.size !== 1 || candidate === undefined)
    throw new Error(
      "This local time is missing or ambiguous because of a clock change. Choose another time.",
    );
  return candidate;
}

export function shiftSchedule(
  fields: ScheduleFields,
  target: ScheduleTarget,
  minutes: number,
  timezone: string,
): ScheduleFields {
  if (!Number.isSafeInteger(minutes) || minutes === 0)
    throw new Error("Choose a non-zero whole-minute duration.");
  const result = { ...fields };
  for (const field of ["start", "end", "due"] as const) {
    const value = fields[field];
    if (!value || (target !== "all" && target !== field)) continue;
    const dateOnly = value.length === 10;
    if (dateOnly && minutes % 1440 === 0) {
      const shifted = new Date(Date.parse(`${value}T12:00:00Z`) + minutes * 60000)
        .toISOString()
        .slice(0, 10);
      if (!isValidLocalDate(shifted))
        throw new Error("The resulting date is outside the supported range.");
      result[field] = shifted;
      continue;
    }
    result[field] = shiftLocalDateTime(dateOnly ? `${value}T00:00` : value, minutes, timezone);
  }
  return result;
}

export function shiftLocalDateTime(value: string, minutes: number, timezone: string): string {
  const instant = localInstant(value, timezone);
  const shifted = formatLocalInstant(instant + minutes * 60000, timezone);
  if (!isValidLocalDate(shifted.slice(0, 10)))
    throw new Error("The resulting date is outside the supported range.");
  // A repeated local hour cannot be represented unambiguously by the form.
  localInstant(shifted, timezone);
  return shifted;
}
