import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  type DayButtonProps,
  DayPicker,
  type DayPickerProps,
  getDefaultClassNames,
} from "react-day-picker";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type CalendarProps = DayPickerProps & {
  buttonVariant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
};

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: CalendarProps) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn(
        "group/calendar w-fit bg-background p-3 [--cell-size:2.5rem] sm:[--cell-size:2.25rem]",
        className,
      )}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("en-GB", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaults.root),
        months: cn("relative flex flex-col gap-4", defaults.months),
        month: cn("flex w-full flex-col gap-4", defaults.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaults.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "min-h-0 size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaults.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "min-h-0 size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaults.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaults.month_caption,
        ),
        caption_label: cn("text-sm font-medium select-none", defaults.caption_label),
        month_grid: cn("w-full border-collapse", defaults.month_grid),
        weekdays: cn("flex", defaults.weekdays),
        weekday: cn(
          "flex-1 rounded-md text-xs font-normal text-muted-foreground select-none",
          defaults.weekday,
        ),
        week: cn("mt-1 flex w-full", defaults.week),
        day: cn(
          "group/day relative aspect-square h-full w-full p-0 text-center select-none",
          defaults.day,
        ),
        today: cn(
          "rounded-md bg-accent text-accent-foreground data-[selected=true]:bg-primary",
          defaults.today,
        ),
        outside: cn("text-muted-foreground opacity-50", defaults.outside),
        disabled: cn("text-muted-foreground opacity-50", defaults.disabled),
        hidden: cn("invisible", defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...iconProps }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeft
              : orientation === "right"
                ? ChevronRight
                : ChevronDown;
          return <Icon className={cn("size-4", className)} {...iconProps} />;
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({ className, day, modifiers, ...props }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      data-day={day.date.toISOString().slice(0, 10)}
      data-selected={modifiers.selected}
      className={cn(
        "min-h-0 size-(--cell-size) rounded-md p-0 text-sm font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-2 group-data-[focused=true]/day:ring-ring data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground",
        className,
      )}
      {...props}
    />
  );
}
