import { Info } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

const help = {
  Task: "Name the task, add notes, choose its project and priority, or schedule a timed session.",
  Plan: "Choose when the task is available, when to finish it, and whether it repeats.",
  Labels:
    "Use labels to organize your tasks. Open the label editor to select existing labels or create a new one.",
};

export function TaskFormSection({
  title,
  children,
}: {
  title: keyof typeof help;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="min-w-0 rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
    >
      <div className="flex items-center gap-1">
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        <Popover>
          <PopoverTrigger
            type="button"
            aria-label={`About ${title}`}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Info className="size-3.5" aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="start" className="max-w-[calc(100vw-2rem)]">
            <PopoverTitle>{title}</PopoverTitle>
            <p className="text-sm">{help[title]}</p>
          </PopoverContent>
        </Popover>
      </div>
      <div className="mt-2 grid min-w-0 gap-3">{children}</div>
    </section>
  );
}
