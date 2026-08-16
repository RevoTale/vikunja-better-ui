import { CalendarDays } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
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
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formattedDate = formatDate(value);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isMobile || !dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [isMobile, open]);

  useEffect(() => {
    if (!open || isMobile) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [isMobile, open]);

  const trigger = (
    <Button
      ref={triggerRef}
      id={id}
      variant="outline"
      className={cn(
        "w-full justify-start text-left font-normal",
        !formattedDate && "text-muted-foreground",
      )}
      disabled={disabled}
      data-form-field={name}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={`${formattedDate ? `Change ${label}, ${formattedDate}` : `Choose ${label}`}${required ? ", required" : ""}`}
      onClick={() => setOpen((current) => !current)}
      {...attributes}
    >
      <CalendarDays aria-hidden="true" className="size-4" />
      {formattedDate || "Choose date"}
    </Button>
  );

  const closeAndRestoreFocus = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const chooseDate = (date: Date) => {
    onChange(isoDateFromCalendarDate(date));
    closeAndRestoreFocus();
  };
  const clearDate = () => {
    onChange("");
    closeAndRestoreFocus();
  };
  const calendar = (
    <DateCalendar value={value} defaultDate={defaultDate} label={label} onSelect={chooseDate} />
  );

  return (
    <div ref={rootRef} className="relative">
      {trigger}
      {isMobile ? (
        <dialog
          ref={dialogRef}
          className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[calc(100dvh-3rem)] w-full max-w-none rounded-t-lg border bg-background p-0 text-foreground backdrop:bg-black/50"
          aria-labelledby={`${id}-drawer-title`}
          onCancel={(event) => {
            event.preventDefault();
            closeAndRestoreFocus();
          }}
          onClose={() => setOpen(false)}
        >
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
          <div className="grid gap-1.5 p-4 text-center">
            <h2 id={`${id}-drawer-title`} className="font-semibold">
              Choose {label.toLowerCase()}
            </h2>
            <p className="text-sm text-muted-foreground">Select a date from the calendar.</p>
          </div>
          <div className="flex max-h-[60dvh] justify-center overflow-y-auto px-2">{calendar}</div>
          <div className="grid gap-2 p-4">
            {value ? (
              <Button variant="ghost" onClick={clearDate}>
                Clear date
              </Button>
            ) : null}
            <Button variant="outline" onClick={closeAndRestoreFocus}>
              Cancel
            </Button>
          </div>
        </dialog>
      ) : open ? (
        <div
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          className="absolute left-0 top-[calc(100%+0.25rem)] z-50 w-auto rounded-md border bg-popover text-popover-foreground shadow-md"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeAndRestoreFocus();
            }
          }}
        >
          {calendar}
          {value ? (
            <div className="border-t p-2">
              <Button variant="ghost" size="compact" className="w-full" onClick={clearDate}>
                Clear date
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <input type="hidden" name={name} value={value} disabled={disabled} />
    </div>
  );
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
