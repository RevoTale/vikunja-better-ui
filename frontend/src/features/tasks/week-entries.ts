export type WeekEntry<Task, Projection> =
  | { kind: "task"; task: Task }
  | { kind: "projection"; projection: Projection };

type WeekTaskSchedule = {
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
    const leftTimes = weekEntryTimes(left);
    const rightTimes = weekEntryTimes(right);
    const timeOrder =
      leftTimes[0] - rightTimes[0] || leftTimes[1] - rightTimes[1] || leftTimes[2] - rightTimes[2];
    if (timeOrder !== 0 || left.kind === right.kind) return timeOrder;
    return left.kind === "task" ? -1 : 1;
  });
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
