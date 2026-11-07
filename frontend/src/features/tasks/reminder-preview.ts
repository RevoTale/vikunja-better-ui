import type { Row } from "./edit-storage-rows";
import { formReminders, relativeReminderLabel } from "./reminder-fields";

export function reminderPreviewRows(form: FormData): Row[] {
  const reminders = formReminders(form);
  if (!reminders) return [];
  return [
    [
      "reminders",
      reminders
        .map((item) =>
          item.relativeTo
            ? relativeReminderLabel(item.relativeTo, item.relativePeriod ?? 0)
            : item.localAt || item.at || "Choose date and time",
        )
        .join("; ") || "None",
      "Saved as native Vikunja reminders. These do not change the plan, deadline, or Today. Delivery follows Vikunja notification settings.",
    ],
  ];
}
