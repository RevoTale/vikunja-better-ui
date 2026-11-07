import type { TaskItem } from "./task-row";

export type RhythmPeriod = "WEEK" | "MONTH" | "YEAR";

const days = { DAY: 1, WEEK: 7, MONTH: 365.2425 / 12, YEAR: 365.2425 };

export function rhythmFrequency(rule: TaskItem["recurrenceRule"], period: RhythmPeriod): string {
  if (!rule || !Number.isFinite(rule.interval) || rule.interval <= 0)
    return "Frequency unavailable";
  const count = days[period] / (days[rule.unit] * rule.interval);
  const unit = period.toLowerCase();
  if (count < 1) return `Less than once / ${unit}`;
  const rounded = Math.round(count * 10) / 10;
  const calendarConversion = (rule.unit === "MONTH") !== (period === "MONTH" || period === "YEAR");
  const approximate = calendarConversion || Math.abs(count - rounded) > 0.000001;
  return `${approximate ? "≈ " : ""}${rounded}× / ${unit}`;
}
