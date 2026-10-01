import { useQuery } from "@apollo/client/react";
import { AppSelect } from "@/components/app-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { ProjectsDocument, type TaskDetailsQuery } from "@/graphql/graphql";
import { TaskLabelPicker } from "./task-label-picker";
import { taskPriorityOptions } from "./task-priority";

export type SubtaskParent = NonNullable<TaskDetailsQuery["task"]>;

export function SubtaskProperties({
  parent,
  onPendingChange,
}: {
  parent: SubtaskParent;
  onPendingChange: (pending: boolean) => void;
}) {
  const projects = useQuery(ProjectsDocument);
  const options = [
    ...new Map(
      [parent.project, ...(projects.data?.projects.items ?? [])].map((project) => [
        project.id,
        project,
      ]),
    ).values(),
  ];
  return (
    <details className="space-y-3">
      <summary className="cursor-pointer text-sm">Properties — copied once from parent</summary>
      <Field>
        <FieldLabel htmlFor="subtask-project">Project</FieldLabel>
        <AppSelect
          id="subtask-project"
          name="projectId"
          defaultValue={parent.project.id}
          options={options.map((project) => ({ value: project.id, label: project.title }))}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="subtask-priority">Priority</FieldLabel>
        <AppSelect
          id="subtask-priority"
          name="priority"
          defaultValue={parent.priority}
          options={taskPriorityOptions}
        />
      </Field>
      <TaskLabelPicker initialLabels={parent.labels} onPendingChange={onPendingChange} />
      <p className="text-xs text-muted-foreground">Dates, Job and recurrence are not copied.</p>
    </details>
  );
}
