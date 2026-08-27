type ActionableTask = {
  isDone: boolean;
  kind: "ONE_TIME" | "RECURRING" | "JOB" | "INVALID";
  recurrenceRule: unknown | null;
};

export function taskDetailActionPolicy(task: ActionableTask): {
  canDelete: boolean;
  canSkip: boolean;
} {
  const isActive = !task.isDone;
  return {
    canDelete: isActive,
    canSkip: isActive && task.recurrenceRule !== null,
  };
}
