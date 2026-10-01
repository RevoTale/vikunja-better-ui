import { type TaskItem, TaskRow } from "./task-row";

export function LongTermTasks(props: {
  tasks: TaskItem[];
  countLoading: boolean;
  returnTo: string;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
}) {
  const groups = [
    { title: "Later", tasks: props.tasks.filter((task) => task.dueAt !== null) },
    { title: "No deadline", tasks: props.tasks.filter((task) => task.dueAt === null) },
  ];
  return (
    <div className="grid gap-5">
      {groups
        .filter((group) => group.tasks.length > 0)
        .map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="mb-2 text-lg font-semibold">{group.title}</h2>
            <div className="grid gap-2 sm:gap-3">
              {group.tasks.map((task) => (
                <TaskRow key={task.id} {...props} task={task} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
