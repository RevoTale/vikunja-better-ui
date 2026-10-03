import { type ListSearch, parseListSearch } from "./list-search";
import { currentDateInTimeZone, isValidLocalDate } from "./local-date-time";
import { shiftLocalDate } from "./week-search";

export type DaySearch = ListSearch & { date?: string };

export function parseDaySearch(search: Record<string, unknown>): DaySearch {
  const date = search["date"];
  return {
    ...parseListSearch(search),
    ...(typeof date === "string" && isValidLocalDate(date) ? { date } : {}),
  };
}

export function navigateDaySearch(
  search: DaySearch,
  timezone: string | undefined,
  offset: number | null,
  now = new Date(),
): DaySearch | undefined {
  const { date, ...filters } = search;
  if (offset === null) return { ...filters, page: 1 };
  const today = timezone ? currentDateInTimeZone(timezone, now) : undefined;
  if (!today) return undefined;
  const next = shiftLocalDate(date ?? today, offset);
  return { ...filters, page: 1, ...(next !== today ? { date: next } : {}) };
}
