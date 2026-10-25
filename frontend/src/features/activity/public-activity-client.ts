import type { TaskPriority } from "@/graphql/graphql";

export type ActivityDaySnapshot = {
  date: string;
  count: number;
  completedWithDeadline: number;
  completedOnTime: number;
};

export type ActivityPrioritySnapshot = {
  priority: TaskPriority;
  count: number;
};

export type ActivitySnapshot = {
  days: ActivityDaySnapshot[];
  priorities: ActivityPrioritySnapshot[];
  total: number;
  timezone: string;
  generatedAt: string;
  refreshAt: string;
};

export type AllTimeActivitySnapshot = {
  weeks: ActivityDaySnapshot[];
  priorities: ActivityPrioritySnapshot[];
  total: number;
  timezone: string;
  generatedAt: string;
  refreshAt: string;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type SnapshotParser<T> = (value: unknown) => T;

export type PublicPageAvailability = { activityEnabled: boolean; allTimeEnabled: boolean };

const priorities = new Set<TaskPriority>(["UNSET", "LOW", "MEDIUM", "HIGH", "URGENT", "DO_NOW"]);

export function parseActivitySnapshot(value: unknown): ActivitySnapshot {
  const record = snapshotRecord(value);
  const snapshot = {
    days: parseDays(record["days"]),
    priorities: parsePriorities(record["priorities"]),
    total: naturalNumber(record["total"]),
    timezone: nonemptyString(record["timezone"]),
    generatedAt: timestamp(record["generatedAt"]),
    refreshAt: timestamp(record["refreshAt"]),
  };
  if (snapshot.days.length !== 14) {
    throw invalidResponse();
  }
  return snapshot;
}

export function parseAllTimeActivitySnapshot(value: unknown): AllTimeActivitySnapshot {
  const record = snapshotRecord(value);
  const weeks = parseDays(record["weeks"]);
  if (weeks.length > 13) {
    throw invalidResponse();
  }
  return {
    weeks,
    priorities: parsePriorities(record["priorities"]),
    total: naturalNumber(record["total"]),
    timezone: nonemptyString(record["timezone"]),
    generatedAt: timestamp(record["generatedAt"]),
    refreshAt: timestamp(record["refreshAt"]),
  };
}

export async function requestPublicSnapshot<T>(
  path: string,
  parser: SnapshotParser<T>,
  fetcher: Fetcher = fetch,
): Promise<T> {
  const response = await fetcher(path, {
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Public activity could not be loaded");
  }
  return parser(await response.json());
}

export function readPublicBootstrap<T>(id: string, parser: SnapshotParser<T>): T | null {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLTemplateElement)) {
    return null;
  }
  const source = node.content.textContent?.trim();
  if (!source) {
    return null;
  }
  try {
    return parser(JSON.parse(source) as unknown);
  } catch {
    return null;
  }
}

export function readPublicAvailability(): PublicPageAvailability | null {
  return readPublicBootstrap("public-page-config", (value) => {
    const record = snapshotRecord(value);
    if (
      typeof record["activityEnabled"] !== "boolean" ||
      typeof record["allTimeEnabled"] !== "boolean"
    ) {
      throw invalidResponse();
    }
    return {
      activityEnabled: record["activityEnabled"],
      allTimeEnabled: record["allTimeEnabled"],
    };
  });
}

function parseDays(value: unknown): ActivityDaySnapshot[] {
  if (!Array.isArray(value)) {
    throw invalidResponse();
  }
  return value.map((item) => {
    const day = snapshotRecord(item);
    const date = nonemptyString(day["date"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw invalidResponse();
    }
    const count = naturalNumber(day["count"]);
    const completedWithDeadline = naturalNumber(day["completedWithDeadline"]);
    const completedOnTime = naturalNumber(day["completedOnTime"]);
    if (completedOnTime > completedWithDeadline || completedWithDeadline > count) {
      throw invalidResponse();
    }
    return {
      date,
      count,
      completedWithDeadline,
      completedOnTime,
    };
  });
}

function parsePriorities(value: unknown): ActivityPrioritySnapshot[] {
  if (!Array.isArray(value)) {
    throw invalidResponse();
  }
  return value.map((item) => {
    const priority = snapshotRecord(item);
    const name = nonemptyString(priority["priority"]);
    if (!priorities.has(name as TaskPriority)) {
      throw invalidResponse();
    }
    return { priority: name as TaskPriority, count: naturalNumber(priority["count"]) };
  });
}

function snapshotRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidResponse();
  }
  return value as Record<string, unknown>;
}

function naturalNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalidResponse();
  }
  return value;
}

function nonemptyString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw invalidResponse();
  }
  return value;
}

function timestamp(value: unknown): string {
  const result = nonemptyString(value);
  if (Number.isNaN(Date.parse(result))) {
    throw invalidResponse();
  }
  return result;
}

function invalidResponse(): Error {
  return new Error("Invalid public activity response");
}
