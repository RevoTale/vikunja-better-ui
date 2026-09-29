export type WeekEntry<Task, Projection> =
  | { kind: "task"; task: Task }
  | { kind: "projection"; projection: Projection };

type WeekTaskSchedule = {
  isOverdue?: boolean;
  startAt?: string | null;
  endAt?: string | null;
  dueAt: string | null;
};

export function mergeWeekEntries<
  Task extends WeekTaskSchedule,
  Projection extends { dueAt: string },
>(tasks: Task[], projections: Projection[]): Array<WeekEntry<Task, Projection>> {
  return [
    ...tasks.map((task): WeekEntry<Task, Projection> => ({ kind: "task", task })),
    ...projections.map(
      (projection): WeekEntry<Task, Projection> => ({ kind: "projection", projection }),
    ),
  ].sort((left, right) => {
    const leftOverdue = left.kind === "task" && left.task.isOverdue === true;
    const rightOverdue = right.kind === "task" && right.task.isOverdue === true;
    if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
    // The server owns priority/due/title/ID ordering. Do not reorder overdue
    // tasks by start time while merging the future computed occurrences.
    if (leftOverdue && rightOverdue) return 0;
    const timeOrder = compareTimes(weekEntryTimes(left), weekEntryTimes(right));
    if (timeOrder !== 0 || left.kind === right.kind) return timeOrder;
    return left.kind === "task" ? -1 : 1;
  });
}

function compareTimes(left: [number, number, number], right: [number, number, number]): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

function weekEntryTimes<Task extends WeekTaskSchedule, Projection extends { dueAt: string }>(
  entry: WeekEntry<Task, Projection>,
): [number, number, number] {
  if (entry.kind === "projection") {
    const due = timestamp(entry.projection.dueAt);
    return [due, due, due];
  }

  const due = timestamp(entry.task.dueAt);
  const end = timestamp(entry.task.endAt ?? entry.task.dueAt);
  return [timestamp(entry.task.startAt ?? entry.task.endAt ?? entry.task.dueAt), end, due];
}

function timestamp(value: string | null): number {
  return value ? Date.parse(value) : Number.POSITIVE_INFINITY;
}
