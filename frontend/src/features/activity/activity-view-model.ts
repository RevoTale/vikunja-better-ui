import type { TaskPriority } from "@/graphql/graphql";

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
