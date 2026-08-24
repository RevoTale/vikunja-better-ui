type RecurrenceUnit = "DAY" | "WEEK" | "MONTH";

type RecurrenceHintTask = {
  dueAt: string | null;
  hasDueTime: boolean;
  timezone: string;
  recurrenceRule: {
    interval: number;
    unit: RecurrenceUnit;
    mode: "FROM_COMPLETION" | "SCHEDULED_CYCLE";
    keepDueTime: boolean;
  } | null;
};

export function recurrenceHint(task: RecurrenceHintTask): string | null {
  const rule = task.recurrenceRule;
  if (rule?.mode !== "FROM_COMPLETION") return null;

  if (task.hasDueTime && rule.keepDueTime && task.dueAt) {
    return `Next: ${quantity(rule.interval, `calendar ${unitName(rule.unit)}`)} after completion at ${formatTime(task.dueAt, task.timezone)}.`;
  }
  if (task.hasDueTime) {
    const hours = rule.interval * (rule.unit === "WEEK" ? 168 : 24);
    return `Next: exactly ${quantity(hours, "hour")} after completion.`;
  }
  return `Next: ${quantity(rule.interval, unitName(rule.unit))} after completion.`;
}

function unitName(unit: RecurrenceUnit): string {
  if (unit === "DAY") return "day";
  if (unit === "WEEK") return "week";
  return "month";
}

function quantity(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function formatTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
