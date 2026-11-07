import { CalendarDays } from "lucide-react";
import { type ReactNode, type RefObject, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { isoDateFromCalendarDate } from "./calendar-date";
import { DateCalendar, formatDate } from "./date-calendar";

type DatePickerFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  defaultDate: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  triggerText?: string;
  resetLabel?: string;
  calendarFooter?: ReactNode;
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
  triggerText,
  resetLabel = "Clear date",
  calendarFooter,
  ...attributes
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 639px)");
  const inputRef = useRef<HTMLInputElement>(null);
  const trigger = (
    <DateTrigger
      id={id}
      name={name}
      label={label}
      value={value}
      disabled={disabled}
      required={required}
      {...(triggerText ? { triggerText } : {})}
      {...attributes}
    />
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
            {calendarFooter}

            <DialogFooter className="m-0 rounded-none p-4">
              {value ? (
                <Button variant="ghost" className="h-11" onClick={clearDate}>
                  {resetLabel}
                </Button>
              ) : null}
              <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>
                {calendarFooter ? "Done" : "Cancel"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={trigger} />
          <PopoverContent
            aria-label={`Choose ${label.toLowerCase()}`}
            align="start"
            className="w-auto gap-0 p-0"
          >
            {calendar}
            {calendarFooter}
            <CalendarDone enabled={Boolean(calendarFooter)} onDone={() => setOpen(false)} />
            {value ? (
              <div className="border-t p-2">
                <Button variant="ghost" className="w-full" onClick={clearDate}>
                  {resetLabel}
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

function CalendarDone({ enabled, onDone }: { enabled: boolean; onDone: () => void }) {
  if (!enabled) return null;
  return (
    <div className="border-t p-2">
      <Button type="button" variant="outline" className="w-full" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

function DateTrigger({
  id,
  name,
  label,
  value,
  disabled,
  required,
  triggerText,
  ...attributes
}: Omit<DatePickerFieldProps, "onChange" | "defaultDate" | "calendarFooter" | "resetLabel">) {
  const formattedDate = formatDate(value);
  return (
    <Button
      id={id}
      type="button"
      variant={triggerText ? "link" : "outline"}
      className={cn(
        triggerText ? "h-9 px-0" : "h-11 w-full justify-start text-left font-normal",
        !formattedDate && "text-muted-foreground",
      )}
      disabled={disabled}
      data-form-field={name}
      aria-label={
        triggerText ??
        `${formattedDate ? `Change ${label}, ${formattedDate}` : `Choose ${label}, Choose date`}${required ? ", required" : ""}`
      }
      {...attributes}
    >
      {!triggerText && <CalendarDays aria-hidden="true" className="size-4" />}
      {triggerText ?? (formattedDate || "Choose date")}
    </Button>
  );
}
