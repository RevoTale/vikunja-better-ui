import type { TaskPriority } from "@/graphql/graphql";
import type { AllTimeActivityView } from "./activity-view-model";

type Activity = Pick<AllTimeActivityView, "weeks" | "priorities" | "total">;

export function filterAllTimePriorities(activity: Activity, priorities: readonly TaskPriority[]) {
  const selected = new Set(priorities);
  const counts = activity.priorities.map((item) => ({
    ...item,
    count: selected.has(item.priority) ? item.count : 0,
  }));
  const weeks = activity.weeks.map((week) => {
    const totals = { count: 0, completedWithDeadline: 0, completedOnTime: 0 };
    for (const item of week.priorities) {
      if (!selected.has(item.priority)) continue;
      totals.count += item.count;
      totals.completedWithDeadline += item.completedWithDeadline;
      totals.completedOnTime += item.completedOnTime;
    }
    return { ...week, ...totals };
  });
  return { weeks, priorities: counts, total: counts.reduce((sum, item) => sum + item.count, 0) };
}
