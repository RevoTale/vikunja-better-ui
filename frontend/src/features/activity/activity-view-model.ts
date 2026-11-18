import { CombinedGraphQLErrors } from "@apollo/client/errors";
import type { PublicAllTimeActivityQuery, TaskPriority } from "@/graphql/graphql";
import type { AllTimeActivitySnapshot } from "./public-activity-client";

export type ActivityDayView = {
  date: string;
  count: number;
  completedWithDeadline: number;
  completedOnTime: number;
};

export type ActivityPriorityView = {
  priority: TaskPriority;
  count: number;
};

export type ActivityView = {
  days: readonly ActivityDayView[];
  priorities: readonly ActivityPriorityView[];
  total: number;
  timezone: string;
  generatedAt: string;
  refreshAt: string;
};

export type ActivityValueSource = "public" | "private";

export function visibleActivity<Public, Private>(
  publicValue: Public | null,
  privateValue: Private | null | undefined,
  authenticated: boolean,
  request: { loading: boolean; error?: unknown },
) {
  const errors = CombinedGraphQLErrors.is(request.error) ? request.error.errors : [];
  const denied =
    authenticated && errors.some((error) => error.extensions?.["code"] === "FORBIDDEN");
  const lostSession = errors.some((error) => error.extensions?.["code"] === "UNAUTHENTICATED");
  const personal = authenticated && !denied && !lostSession ? privateValue : null;
  const showPublic = !authenticated || (request.loading && !request.error);
  const value = personal ?? (showPublic ? publicValue : null);
  const valueSource: ActivityValueSource | null = personal ? "private" : value ? "public" : null;
  return {
    value,
    valueSource,
    denied,
    updating: authenticated && request.loading && value !== null,
  };
}

export function activitySubtitle(
  source: { authenticated: boolean; valueSource: ActivityValueSource | null; updating: boolean },
  period: string,
) {
  if (source.updating) {
    return source.valueSource === "public"
      ? "Public snapshot · Loading yours…"
      : "Your activity · Refreshing…";
  }
  return `${source.authenticated ? "Your activity" : "Public activity"} · ${period}`;
}

export function activityDataStatus(source: ActivityValueSource | null, stale: boolean): string {
  if (source === "public") return "Public snapshot cached for 1 hour.";
  if (source === "private") {
    return stale ? "Previously loaded private data." : "Current private data.";
  }
  return "Activity data.";
}

export type ActivityPriorityTimelinessView = ActivityPriorityView & {
  completedWithDeadline: number;
  completedOnTime: number;
};

export type ActivityWeekView = ActivityDayView & {
  priorities: readonly ActivityPriorityTimelinessView[];
};

export type AllTimeActivityView = {
  weeks: readonly ActivityWeekView[];
  priorities: readonly ActivityPriorityView[];
  total: number;
  timezone: string;
  generatedAt: string;
  refreshAt: string;
};

export function allTimeActivityView(
  activity: AllTimeActivitySnapshot | PublicAllTimeActivityQuery["publicAllTimeActivity"],
): AllTimeActivityView | null {
  if (!activity) return null;
  const weeks = activity.weeks.map((week) => {
    if (!("priorities" in week)) return { ...week, priorities: [] };
    const totals = { count: 0, completedWithDeadline: 0, completedOnTime: 0 };
    for (const priority of week.priorities) {
      totals.count += priority.count;
      totals.completedWithDeadline += priority.completedWithDeadline;
      totals.completedOnTime += priority.completedOnTime;
    }
    return { ...week, ...totals };
  });
  return { ...activity, weeks };
}
