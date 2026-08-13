import type { TaskPriority } from "@/graphql/graphql";
import { cn } from "@/lib/cn";
import { taskPriorityOption } from "./task-priority";

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const option = taskPriorityOption(priority);
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
        option.className,
        className,
      )}
    >
      {option.label}
    </span>
  );
}
