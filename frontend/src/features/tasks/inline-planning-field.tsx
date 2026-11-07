import { type InlineTask, inlinePlanningDates } from "./inline-task-input";
import { currentDateInTimeZone } from "./local-date-time";
import { isWholePlanningDay } from "./planning-dates";
import { PlanningWindowFields } from "./planning-window-fields";
import type { InlineTaskEditing } from "./use-inline-task-editing";

export function InlinePlanningField({
  task,
  editor,
}: {
  task: InlineTask;
  editor: InlineTaskEditing;
}) {
  const startTime =
    editor.input.planningWindow !== undefined
      ? (editor.input.planningWindow?.startsAtTime ?? "")
      : (editor.input.startAt?.slice(11) ?? "");
  const endTime =
    editor.input.planningWindow?.endsAtTime ??
    (task.endAt && isWholePlanningDay(task.endAt, task.timezone)
      ? ""
      : (editor.input.endAt?.slice(11) ?? ""));
  return (
    <PlanningWindowFields
      value={inlinePlanningDates(editor.input)}
      today={currentDateInTimeZone(task.timezone) ?? ""}
      {...(startTime && startTime !== "00:00" ? { specificStart: true } : {})}
      deadline={editor.input.dueDate ?? ""}
      onChange={({ from, through }, specific) =>
        editor.setInput((input) => ({
          ...input,
          planningWindow:
            from || through
              ? {
                  startsOn: from,
                  endsOn: through,
                  startsAtTime: specific === false ? null : startTime || null,
                  endsAtTime: endTime || null,
                }
              : null,
          ...(!from && !through ? { startAt: null, endAt: null } : {}),
        }))
      }
    />
  );
}
