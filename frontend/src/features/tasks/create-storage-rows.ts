import { deadlineReason, propertyRows, type Row, repeatRows } from "./edit-storage-rows";
import { jobTitlePlaceholder } from "./job-title";
import { reminderPreviewRows } from "./reminder-preview";
import { formatLocalInstant, localInstant } from "./shift-schedule";
import { type CreationBaseType, validateTaskForm } from "./task-form-validation";
import { parseTaskPriority } from "./task-priority";
import { formRecurrence } from "./use-create-task-mutation";

export function createStorageRows(form: FormData, type: CreationBaseType, timezone: string): Row[] {
  const text = (name: string) => String(form.get(name) ?? "");
  const job = text("job") === "on";
  const recurring = type === "recurring";
  const rule = recurring ? formRecurrence(form) : null;
  const due = text(recurring ? "firstDueDate" : "dueDate");
  const time = text("dueTime");
  const autoTitle = job && !recurring && !text("title").trim();
  const markers = [
    job && "vbu:job",
    !job && due && !time && "vbu:date-only",
    rule?.keepDueTime && "vbu:fixed-due-time",
    recurring && !job && text("availableFrom") && "vbu:recurring-availability",
  ].filter(Boolean);
  const issues = Object.values(validateTaskForm(type, form));
  const rows: Row[] = [];
  if (issues.length)
    rows.push([
      "Incomplete draft",
      issues.join(" "),
      "Complete these fields before creating the task.",
    ]);
  return [
    ...rows,
    ...reminderPreviewRows(form),
    ...(job ? jobDates(text, timezone) : calendarDates(text, recurring, due, time)),
    ...repeatRows({ recurrence: rule }),
    ...propertyRows(
      {
        title: autoTitle
          ? jobTitlePlaceholder({ date: text("startDate"), time: text("startTime") })
          : text("title"),
        description: text("description"),
        projectId: text("projectId"),
        priority: parseTaskPriority(text("priority")) ?? "UNSET",
        labelIds: form.getAll("labelIds").map(String),
      },
      autoTitle
        ? "A one-time timed session with an empty title takes its name from the local start date and time."
        : undefined,
    ),
    [
      "workflow labels",
      markers.join(", "),
      "Better UI records the selected scheduling behavior using reserved Vikunja labels.",
    ],
  ];
}

function calendarDates(
  text: (name: string) => string,
  recurring: boolean,
  due: string,
  time: string,
): Row[] {
  const finish = recurring ? "" : text("planningEndsOn");
  return [
    availabilityRow(text, recurring),
    [
      "end_date",
      finish && `${finish} ${text("planningFinishTime") || "23:59:59"}`,
      text("planningFinishTime")
        ? "The plan ends at the selected local time."
        : finish
          ? "The entire planned finish day is available."
          : "This draft has no planned finish.",
    ],
    [
      "due_date",
      due && `${due} ${time || "23:59:59"}`,
      recurring
        ? "The first due date anchors the repeating task. Without a time it falls at the end of the local day."
        : deadlineReason(due, time),
    ],
  ];
}

function availabilityRow(text: (name: string) => string, recurring: boolean): Row {
  if (text("startNow") === "true")
    return [
      "start_date",
      "Now, when created",
      "The server records the creation instant. If the window has already ended, its original start is kept.",
    ];
  const start = text(recurring ? "availableFrom" : "planningStartsOn");
  const clock = text(recurring ? "availableFromTime" : "planningStartTime");
  return [
    "start_date",
    start && `${start} ${clock || "00:00:00"}`,
    start
      ? "The task becomes available at the selected local time, or at the start of the day if no time is chosen."
      : "No availability window was selected.",
  ];
}

function jobDates(text: (name: string) => string, timezone: string): Row[] {
  const start = `${text("startDate")}T${text("startTime")}`;
  const duration = Number(text("durationMinutes"));
  const window = Number(text("completionWindowMinutes"));
  try {
    const instant = localInstant(start, timezone);
    const format = (minutes: number) =>
      formatLocalInstant(instant + minutes * 60000, timezone).replace("T", " ");
    return [
      ["start_date", format(0), "This is the selected local session start."],
      [
        "end_date",
        duration > 0 ? format(duration) : "",
        "The session ends after its duration has elapsed.",
      ],
      [
        "due_date",
        duration > 0 && window > 0 ? format(duration + window) : "",
        "The extra time to finish starts when the session ends.",
      ],
    ];
  } catch {
    return [
      [
        "Session dates",
        "Choose a valid local start and duration.",
        "A timed session needs a start that exists unambiguously in your timezone.",
      ],
    ];
  }
}
