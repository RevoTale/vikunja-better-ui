import { parseProject } from "./list-search";

export type WeekSearch = { project: string; week?: string };

export function parseWeekSearch(search: Record<string, unknown>): WeekSearch {
  const project = parseProject(search["project"]);
  const week = parseLocalDate(search["week"]);
  return week ? { project, week } : { project };
}

export function shiftLocalDate(value: string, days: number): string {
  const parsed = localDateParts(value);
  if (!parsed) return value;
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function parseLocalDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return localDateParts(value) ? value : undefined;
}

function localDateParts(value: string): { year: number; month: number; day: number } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return { year, month, day };
}
