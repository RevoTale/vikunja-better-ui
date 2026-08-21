import {
  type DayButtonProps,
  DayPicker,
  type DayPickerProps,
  getDefaultClassNames,
} from "@daypicker/react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { calendarDateFromISO, isoDateFromCalendarDate } from "./calendar-date";

type DatePickerFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  defaultDate: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function DatePickerField({
  id,
  name,
  label,
  value,
  defaultDate,
  onChange,
  disabled = false,
  required = false,
  ...attributes
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 639px)");
  const inputRef = useRef<HTMLInputElement>(null);
  const formattedDate = formatDate(value);
  const trigger = (
    <Button
      id={id}
      variant="outline"
      className={cn(
        "h-11 w-full justify-start text-left font-normal",
        !formattedDate && "text-muted-foreground",
      )}
      disabled={disabled}
      data-form-field={name}
      aria-label={`${formattedDate ? `Change ${label}, ${formattedDate}` : `Choose ${label}`}${required ? ", required" : ""}`}
      {...attributes}
    >
      <CalendarDays aria-hidden="true" className="size-4" />
      {formattedDate || "Choose date"}
    </Button>
  );

  const chooseDate = (date: Date) => {
    onChange(isoDateFromCalendarDate(date));
    notifyFormInput(inputRef);
    setOpen(false);
  };
  const clearDate = () => {
    onChange("");
    notifyFormInput(inputRef);
    setOpen(false);
  };
  const calendar = (
    <DateCalendar value={value} defaultDate={defaultDate} label={label} onSelect={chooseDate} />
  );

  return (
    <>
      {isMobile ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={trigger} />
          <DialogContent
            className="top-auto bottom-0 left-0 max-h-[calc(100dvh-3rem)] max-w-none translate-x-0 translate-y-0 gap-0 rounded-t-xl rounded-b-none p-0 sm:max-w-none"
            showCloseButton={false}
          >
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
            <DialogHeader className="p-4 text-center">
              <DialogTitle>Choose {label.toLowerCase()}</DialogTitle>
              <DialogDescription>Select a date from the calendar.</DialogDescription>
            </DialogHeader>
            <div className="flex max-h-[60dvh] justify-center overflow-y-auto px-2">{calendar}</div>
            <DialogFooter className="m-0 rounded-none p-4">
              {value ? (
                <Button variant="ghost" className="h-11" onClick={clearDate}>
                  Clear date
                </Button>
              ) : null}
              <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={trigger} />
          <PopoverContent align="start" className="w-auto gap-0 p-0">
            {calendar}
            {value ? (
              <div className="border-t p-2">
                <Button variant="ghost" className="w-full" onClick={clearDate}>
                  Clear date
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
      )}
      <input ref={inputRef} type="hidden" name={name} value={value} disabled={disabled} />
    </>
  );
}

function notifyFormInput(inputRef: RefObject<HTMLInputElement | null>) {
  queueMicrotask(() => {
    inputRef.current?.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });
}

function DateCalendar({
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
        Chevron: ({ className: iconClassName, orientation, ...iconProps }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeft
              : orientation === "right"
                ? ChevronRight
                : ChevronDown;
          return <Icon className={cn("size-4", iconClassName)} {...iconProps} />;
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

function formatDate(value: string): string {
  const date = calendarDateFromISO(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
