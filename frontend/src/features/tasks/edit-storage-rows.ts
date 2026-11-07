import { type InlineTask, type InlineTaskInput, inlineTaskInput } from "./inline-task-input";

export type Row = [field: string, value: string, reason: string];

export function deadlineReason(date?: string | null, time?: string | null) {
  if (!date) return "No deadline was selected.";
  if (!time) return "A deadline without a time is stored at the last second of its local day.";
  return "This is the exact deadline you selected.";
}

export function editStorageRows(draft: InlineTaskInput, task: InlineTask): Row[] {
  const initial = inlineTaskInput(task);
  const plan = draft.planningWindow;
  const start = plan ? `${plan.startsOn} ${plan.startsAtTime || "00:00:00"}` : draft.startAt;
  const end = plan ? `${plan.endsOn} ${plan.endsAtTime || "23:59:59"}` : draft.endAt;
  const due = draft.dueDate && `${draft.dueDate} ${draft.dueTime || "23:59:59"}`;
  const dateValue = (
    value: string | null | undefined,
    original: string | null,
    unchanged: boolean,
  ) => (unchanged && original ? original : value?.replace("T", " ") || "");
  return [
    [
      "start_date",
      dateValue(start, task.startAt, !plan && start === initial.startAt),
      plan
        ? "The planning window opens at the selected start time, or midnight when no time is selected."
        : start
          ? "This is the start of the scheduled work."
          : "No start was scheduled.",
    ],
    [
      "end_date",
      dateValue(end, task.endAt, !plan && end === initial.endAt),
      plan
        ? "The plan ends at the selected finish time, or the last second of the day when no time is selected."
        : end
          ? "This is the planned end of the work."
          : "No planned finish was selected.",
    ],
    [
      "due_date",
      dateValue(
        due,
        task.dueAt,
        draft.dueDate === initial.dueDate && draft.dueTime === initial.dueTime,
      ),
      deadlineReason(draft.dueDate, draft.dueTime),
    ],
    ...repeatRows(draft),
    ...propertyRows(draft),
    [
      "workflow labels",
      workflowLabels(draft, task).join(", "),
      "Better UI uses reserved labels to remember a timed session, a date-only deadline, a fixed recurrence time, or managed recurring availability.",
    ],
  ];
}

function workflowLabels(draft: InlineTaskInput, task: InlineTask) {
  const markers = [];
  if (draft.job) markers.push("vbu:job");
  if (draft.dueDate && !draft.dueTime) markers.push("vbu:date-only");
  if (draft.recurrence?.keepDueTime) markers.push("vbu:fixed-due-time");
  if (
    draft.recurrence &&
    !draft.job &&
    draft.startAt &&
    !draft.endAt &&
    task.labels.some((label) => label.title === "vbu:recurring-availability")
  )
    markers.push("vbu:recurring-availability");
  return markers;
}

export function repeatRows({ recurrence: rule }: Pick<InlineTaskInput, "recurrence">): Row[] {
  if (!rule)
    return [
      ["repeat_after", "0", "Do once switches off recurrence."],
      ["repeat_mode", "0", "Vikunja uses its default mode when recurrence is off."],
    ];
  const monthly = rule.unit === "MONTH";
  const seconds = rule.interval * (rule.unit === "WEEK" ? 604800 : 86400);
  const completion = rule.mode === "FROM_COMPLETION";
  return [
    [
      "repeat_after",
      monthly ? "1" : String(seconds),
      monthly
        ? "A monthly cycle uses 1 with calendar-month mode."
        : `Every ${rule.interval} ${rule.unit.toLowerCase()} interval is stored in seconds.`,
    ],
    [
      "repeat_mode",
      monthly ? "1" : completion ? "2" : "0",
      monthly
        ? "Monthly repeats use calendar months."
        : completion
          ? "The next occurrence is calculated from completion."
          : "The next occurrence follows the scheduled cycle.",
    ],
  ];
}

export function propertyRows(
  draft: Pick<InlineTaskInput, "title" | "description" | "priority" | "projectId" | "labelIds">,
  titleReason = "The task name is saved with surrounding spaces removed.",
): Row[] {
  return [
    ["title", draft.title.trim(), titleReason],
    ["description", draft.description, "The editor supplies the description as rich-text HTML."],
    [
      "project_id",
      String(draft.projectId),
      "Vikunja identifies the selected project by its numeric ID.",
    ],
    [
      "priority",
      String(["UNSET", "LOW", "MEDIUM", "HIGH", "URGENT", "DO_NOW"].indexOf(draft.priority)),
      `The selected priority is ${draft.priority.toLowerCase().replaceAll("_", " ")}. Vikunja stores priorities from 0 to 5.`,
    ],
    [
      "labels (selected IDs)",
      draft.labelIds?.join(", ") || "",
      "These are the ordinary labels selected in Labels. Vikunja attaches them to the task by ID.",
    ],
  ];
}
