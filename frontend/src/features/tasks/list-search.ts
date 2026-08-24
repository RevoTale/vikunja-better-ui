export type ListSearch = { project: string; page: number };

export function parseListSearch(search: Record<string, unknown>): ListSearch {
  return {
    project: parseProject(search["project"]),
    page: parsePage(search["page"]),
  };
}

export function parseProject(value: unknown): string {
  if (value === undefined || value === "all") return "all";
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return "all";
  return value;
}

function parsePage(value: unknown): number {
  if (value === undefined) return 1;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}
