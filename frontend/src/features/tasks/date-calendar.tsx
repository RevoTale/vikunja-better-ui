import {
  type DayButtonProps,
  DayPicker,
  type DayPickerProps,
  getDefaultClassNames,
} from "@daypicker/react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { calendarDateFromISO } from "./calendar-date";
export function DateCalendar({
  value,
  defaultDate,
  label,
  onSelect,
}: {
  value: string;
  defaultDate: string;
  label: string;
  onSelect: (date: Date) => void;
}) {
  const selected = calendarDateFromISO(value);
  const today = calendarDateFromISO(defaultDate);
  const initialMonth = selected ?? today;

  return (
    <Calendar
      mode="single"
      required
      selected={selected}
      {...(initialMonth ? { defaultMonth: initialMonth } : {})}
      {...(today ? { today } : {})}
      timeZone="UTC"
      autoFocus
      aria-label={`${label} calendar`}
      footer={selected ? `Selected ${formatDate(value)}` : "Choose a date."}
      onSelect={onSelect}
    />
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  components,
  ...props
}: DayPickerProps) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn(
        "group/calendar w-fit bg-background p-3 [--cell-size:2.5rem] sm:[--cell-size:2.25rem]",
        className,
      )}
      classNames={{
        root: cn("w-fit", defaults.root),
        months: cn("relative flex flex-col gap-4", defaults.months),
        month: cn("flex w-full flex-col gap-4", defaults.month),
        nav: cn("absolute inset-x-0 top-0 flex justify-between", defaults.nav),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-(--cell-size) p-0",
          defaults.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-(--cell-size) p-0",
          defaults.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) items-center justify-center px-(--cell-size)",
          defaults.month_caption,
        ),
        caption_label: cn("text-sm font-medium", defaults.caption_label),
        month_grid: cn("w-full border-collapse", defaults.month_grid),
        weekdays: cn("flex", defaults.weekdays),
        weekday: cn("flex-1 text-xs text-muted-foreground", defaults.weekday),
        week: cn("mt-1 flex", defaults.week),
        day: cn("group/day relative aspect-square p-0 text-center", defaults.day),
        today: cn("rounded-md bg-accent", defaults.today),
        outside: cn("text-muted-foreground opacity-50", defaults.outside),
        disabled: cn("text-muted-foreground opacity-50", defaults.disabled),
        hidden: cn("invisible", defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarChevron({
  className,
  orientation,
  ...props
}: Parameters<NonNullable<NonNullable<DayPickerProps["components"]>["Chevron"]>>[0]) {
  const Icon =
    orientation === "left" ? ChevronLeft : orientation === "right" ? ChevronRight : ChevronDown;
  return <Icon className={cn("size-4", className)} {...props} />;
}

function CalendarDayButton({ className, day, modifiers, ...props }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const focused = modifiers["focused"];
  const selected = modifiers["selected"];

  useEffect(() => {
    if (focused) ref.current?.focus();
  }, [focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      data-day={day.date.toISOString().slice(0, 10)}
      data-selected={selected}
      className={cn(
        "size-(--cell-size) rounded-md p-0 text-sm font-normal group-data-[focused=true]/day:ring-2 group-data-[focused=true]/day:ring-ring data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function formatDate(value: string): string {
  const date = calendarDateFromISO(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
