type RecurrenceSettingTask = {
  isDone: boolean;
  kind: "ONE_TIME" | "RECURRING" | "JOB" | "INVALID";
  hasDueTime: boolean;
  recurrenceRule: {
    mode: "FROM_COMPLETION" | "SCHEDULED_CYCLE";
    unit: "DAY" | "WEEK" | "MONTH";
    keepDueTime: boolean;
  } | null;
};

export function recurrenceSettingPolicy(task: RecurrenceSettingTask): {
  visible: boolean;
  canEnable: boolean;
} {
  const rule = task.recurrenceRule;
  if (!rule || task.isDone) return { visible: false, canEnable: false };
  const canEnable =
    task.kind === "RECURRING" &&
    task.hasDueTime &&
    rule.mode === "FROM_COMPLETION" &&
    (rule.unit === "DAY" || rule.unit === "WEEK");
  return { visible: canEnable || rule.keepDueTime, canEnable };
}
