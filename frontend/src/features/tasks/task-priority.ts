import type { TaskPriority } from "@/graphql/graphql";

type PriorityOption = {
  value: TaskPriority;
  label: string;
  className: string;
  selectClassName: string;
};

export const taskPriorityOptions = [
  {
    value: "UNSET",
    label: "No priority",
    className: "border-border bg-muted text-foreground",
    selectClassName: "text-foreground",
  },
  {
    value: "LOW",
    label: "Low",
    className: "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    selectClassName: "border-sky-600/40 text-sky-700 dark:text-sky-300",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    className: "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    selectClassName: "border-emerald-600/40 text-emerald-800 dark:text-emerald-300",
  },
  {
    value: "HIGH",
    label: "High",
    className: "border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    selectClassName: "border-amber-600/40 text-amber-800 dark:text-amber-300",
  },
  {
    value: "URGENT",
    label: "Urgent",
    className: "border-orange-600/40 bg-orange-500/10 text-orange-800 dark:text-orange-300",
    selectClassName: "border-orange-600/50 text-orange-800 dark:text-orange-300",
  },
  {
    value: "DO_NOW",
    label: "Do now",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    selectClassName: "border-destructive/50 text-destructive",
  },
] as const satisfies readonly PriorityOption[];

export function isTaskPriority(value: string): value is TaskPriority {
  return taskPriorityOptions.some((option) => option.value === value);
}

export function taskPriorityOption(priority: TaskPriority): PriorityOption {
  return taskPriorityOptions.find((option) => option.value === priority) ?? taskPriorityOptions[0];
}

export function taskPriorityLabel(priority: TaskPriority): string {
  return taskPriorityOption(priority).label;
}
