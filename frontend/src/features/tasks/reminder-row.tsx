import { useId } from "react";
import { Button } from "@/components/ui/button";
import { EditDateTimeField } from "./edit-date-time-field";
import { RelativeReminderFields } from "./relative-reminder-fields";
import type { ReminderAnchor } from "./reminder-anchors";
import type { ReminderDraft } from "./reminder-fields";
import { relativeReminderLabel } from "./reminder-values";

export function ReminderRow({
  row,
  index,
  today,
  anchors,
  onChange,
  onRemove,
}: {
  row: ReminderDraft;
  index: number;
  today: string;
  anchors: readonly ReminderAnchor[];
  onChange: (row: ReminderDraft) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const defaultAnchor = anchors.find((anchor) => anchor.available)?.value;
  const changeDate = (local: string) => {
    if (row.local === local && !row.input.relativeTo) return;
    onChange({ ...row, local, input: { localAt: local } });
  };
  return (
    <fieldset className="grid min-w-0 gap-2 rounded-md border p-3">
      <legend className="px-1 text-xs">Reminder {index + 1}</legend>
      <input type="hidden" name="reminderAt" value={row.input.at ?? ""} />
      <input type="hidden" name="reminderLocalAt" value={row.input.localAt ?? ""} />
      <input type="hidden" name="reminderRelativeTo" value={row.input.relativeTo ?? ""} />
      <input type="hidden" name="reminderRelativePeriod" value={row.input.relativePeriod ?? 0} />
      {row.input.relativeTo ? (
        <>
          <span className="text-sm">
            {relativeReminderLabel(row.input.relativeTo, row.input.relativePeriod ?? 0)}
          </span>
          <RelativeReminderFields
            input={row.input}
            anchors={anchors}
            onChange={(input) => onChange({ ...row, input })}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() => changeDate(row.local || today)}
          >
            Set a specific date and time
          </Button>
        </>
      ) : (
        <AbsoluteReminderFields
          id={id}
          row={row}
          index={index}
          today={today}
          defaultAnchor={defaultAnchor}
          onChange={onChange}
          changeDate={changeDate}
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-self-start"
        aria-label={`Remove reminder ${index + 1}`}
        onClick={onRemove}
      >
        Remove
      </Button>
    </fieldset>
  );
}

function AbsoluteReminderFields({
  id,
  row,
  index,
  today,
  defaultAnchor,
  onChange,
  changeDate,
}: {
  id: string;
  row: ReminderDraft;
  index: number;
  today: string;
  defaultAnchor: string | undefined;
  onChange: (row: ReminderDraft) => void;
  changeDate: (local: string) => void;
}) {
  return (
    <>
      {defaultAnchor ? (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({ ...row, input: { relativeTo: defaultAnchor, relativePeriod: -7200 } })
          }
        >
          Before a task date
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Set a task date to use relative reminders.</p>
      )}
      <EditDateTimeField
        name={id}
        label={`Reminder ${index + 1}`}
        value={row.local}
        defaultDate={today}
        required
        onChange={changeDate}
      />
    </>
  );
}
