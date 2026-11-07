import type { TaskReminderInput } from "@/graphql/graphql";
export function relativeReminderLabel(anchor: string, seconds: number) {
  const label =
    (
      { start_date: "start", end_date: "planned finish", due_date: "deadline" } as Record<
        string,
        string
      >
    )[anchor] ?? anchor;
  if (seconds === 0) return `At ${label}`;
  const amount = Math.abs(seconds);
  const [unit, name] = (
    [
      [86400, "day"],
      [3600, "hour"],
      [60, "minute"],
      [1, "second"],
    ] as const
  ).find(([size]) => amount % size === 0) ?? [1, "second"];
  return `${amount / unit} ${name}${amount / unit === 1 ? "" : "s"} ${seconds < 0 ? "before" : "after"} ${label}`;
}

export function formReminders(form: FormData): TaskReminderInput[] | null {
  if (!form.has("remindersPresent")) return null;
  const local = form.getAll("reminderLocalAt").map(String);
  const relative = form.getAll("reminderRelativeTo").map(String);
  const period = form.getAll("reminderRelativePeriod").map(String);
  return form.getAll("reminderAt").map((at, index) => ({
    at: String(at) || null,
    localAt: local[index] || null,
    relativeTo: relative[index] ?? "",
    relativePeriod: Number(period[index] ?? 0),
  }));
}
