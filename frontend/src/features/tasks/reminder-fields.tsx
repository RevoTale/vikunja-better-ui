import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TaskReminderInput } from "@/graphql/graphql";
import { currentDateInTimeZone } from "./local-date-time";
import type { ReminderAnchor } from "./reminder-anchors";
import { ReminderRow } from "./reminder-row";
import { formatLocalInstant } from "./shift-schedule";

export { formReminders, relativeReminderLabel } from "./reminder-values";

type ExistingReminder = { at: string | null; relativeTo: string; relativePeriod: number };
export type ReminderDraft = { key: number; input: TaskReminderInput; local: string };

export function ReminderFields({
  initial = [],
  timezone,
  anchors = [],
}: {
  initial?: readonly ExistingReminder[];
  timezone: string;
  anchors?: readonly ReminderAnchor[];
}) {
  const today = currentDateInTimeZone(timezone) ?? "";
  const defaultAnchor = anchors.find((anchor) => anchor.available)?.value;
  const [rows, setRows] = useState<ReminderDraft[]>(() =>
    initial.map((item, key) => ({
      key,
      input: item,
      local: item.at ? formatLocalInstant(Date.parse(item.at), timezone) : "",
    })),
  );
  const [nextKey, setNextKey] = useState(initial.length);
  return (
    <div className="grid min-w-0 gap-3 border-t pt-3">
      <input type="hidden" name="remindersPresent" value="true" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Reminders</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setRows((current) => [
              ...current,
              {
                key: nextKey,
                local: today,
                input: defaultAnchor
                  ? { relativeTo: defaultAnchor, relativePeriod: -7200 }
                  : { localAt: today },
              },
            ]);
            setNextKey(nextKey + 1);
          }}
        >
          Add reminder
        </Button>
      </div>
      {rows.map((row, index) => (
        <ReminderRow
          key={row.key}
          row={row}
          index={index}
          today={today}
          anchors={anchors}
          onChange={(next) =>
            setRows((current) => current.map((item) => (item.key === row.key ? next : item)))
          }
          onRemove={() => setRows((current) => current.filter((item) => item.key !== row.key))}
        />
      ))}
      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Times use {timezone}. Notifications are sent by Vikunja according to its notification
          settings.
        </p>
      )}
    </div>
  );
}
