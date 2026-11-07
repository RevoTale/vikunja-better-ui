import { type ListSearch, parseListSearch } from "./list-search";

export type PlanningSearch = ListSearch & {
  period: "week" | "month" | "year" | "custom";
  from?: string;
  through?: string;
};

export function parsePlanningSearch(search: Record<string, unknown>): PlanningSearch {
  const period = search["period"];
  return {
    ...parseListSearch(search),
    period: period === "week" || period === "year" || period === "custom" ? period : "month",
    ...(typeof search["from"] === "string" ? { from: search["from"] } : {}),
    ...(typeof search["through"] === "string" ? { through: search["through"] } : {}),
  };
}
