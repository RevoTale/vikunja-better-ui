import { useState } from "react";

import { AppInput } from "@/components/app-input";
import { AppSelect } from "@/components/app-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { TaskPriority } from "@/graphql/graphql";
import type { CreationType, TaskFormErrors } from "./task-form-validation";
import { isTaskPriority, taskPriorityOption, taskPriorityOptions } from "./task-priority";
import { ValidatedField } from "./validated-field";

export function SharedFields({
  projects,
  defaultProject,
  errors,
  type,
  titlePlaceholder,
}: {
  projects: readonly { id: string; title: string }[];
  defaultProject: string;
  errors: TaskFormErrors;
  type: CreationType;
  titlePlaceholder: string;
}) {
  const [priority, setPriority] = useState<TaskPriority>("UNSET");

  return (
    <>
      <ValidatedField
        name="title"
        label={type === "job" ? "Title (optional)" : "Title"}
        error={errors.title}
      >
        {(attributes) => (
          <AppInput
            id="title"
            name="title"
            autoFocus
            required={type !== "job"}
            placeholder={type === "job" ? titlePlaceholder : undefined}
            maxLength={250}
            {...attributes}
          />
        )}
      </ValidatedField>
      <Field>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Textarea id="description" name="description" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <ValidatedField name="projectId" label="Project" error={errors.projectId}>
          {(attributes) => (
            <AppSelect
              id="projectId"
              name="projectId"
              defaultValue={defaultProject}
              options={projects.map((project) => ({
                value: project.id,
                label: project.title,
              }))}
              required
              {...attributes}
            />
          )}
        </ValidatedField>
        <ValidatedField name="priority" label="Priority" error={errors.priority}>
          {(attributes) => (
            <AppSelect
              id="priority"
              name="priority"
              value={priority}
              className={taskPriorityOption(priority).selectClassName}
              options={taskPriorityOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onValueChange={(nextPriority) => {
                if (isTaskPriority(nextPriority)) setPriority(nextPriority);
              }}
              required
              {...attributes}
            />
          )}
        </ValidatedField>
      </div>
    </>
  );
}
