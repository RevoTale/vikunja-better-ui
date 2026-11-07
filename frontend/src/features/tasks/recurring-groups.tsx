import { type ComponentProps, useState } from "react";
import { Button } from "@/components/ui/button";
import { type RhythmPeriod, rhythmFrequency } from "./recurring-rhythm";
import { type TaskItem, TaskRow } from "./task-row";

function cadence(rule: TaskItem["recurrenceRule"]) {
  if (!rule) return "Other intervals";
  if (rule.interval !== 1) return `Every ${rule.interval} ${rule.unit.toLowerCase()}s`;
  return { DAY: "Daily", WEEK: "Weekly", MONTH: "Monthly" }[rule.unit];
}

export function RecurringGroups({
  tasks,
  ...rowProps
}: Omit<ComponentProps<typeof TaskRow>, "task"> & { tasks: TaskItem[] }) {
  const [period, setPeriod] = useState<RhythmPeriod>("WEEK");
  const groups = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    const title = cadence(task.recurrenceRule);
    const group = groups.get(title);
    if (group) group.push(task);
    else groups.set(title, [task]);
  }
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-semibold">Your rhythm</h2>
          <fieldset className="flex rounded-lg bg-muted p-1" aria-label="Compare habit frequency">
            {(["WEEK", "MONTH", "YEAR"] as const).map((value) => (
              <Button
                key={value}
                variant={period === value ? "default" : "ghost"}
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
              >
                {{ WEEK: "Week", MONTH: "Month", YEAR: "Year" }[value]}
              </Button>
            ))}
          </fieldset>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Average frequency per habit, not completed tasks. After-completion habits assume no delay.
        </p>
      </div>
      {Array.from(groups, ([title, members]) => (
        <section key={title} aria-label={title}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b pb-3">
            <div>
              <h2 className="font-serif text-xl font-semibold">{title}</h2>
              <p className="text-xs text-muted-foreground">{members.length} on this page</p>
            </div>
            <p className="text-sm font-medium tabular-nums" aria-live="polite">
              {rhythmFrequency(members[0]?.recurrenceRule ?? null, period)}
              <span className="ml-1 font-normal text-muted-foreground">per habit</span>
            </p>
          </div>
          <div className="grid gap-2 sm:gap-3">
            {members.map((task) => (
              <div key={task.id} className="min-w-0">
                <p className="mb-1 text-xs text-muted-foreground">
                  {task.recurrenceRule?.mode === "FROM_COMPLETION"
                    ? "After completion · next date follows when you finish"
                    : "Fixed schedule · repeats on its own cycle"}
                </p>
                <TaskRow task={task} showRecurrenceHint {...rowProps} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
