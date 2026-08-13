import { useState } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TaskPriority } from "@/graphql/graphql";
import { cn } from "@/lib/cn";
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
          <Input
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
            <Select
              id="projectId"
              name="projectId"
              defaultValue={defaultProject}
              required
              {...attributes}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </Select>
          )}
        </ValidatedField>
        <ValidatedField name="priority" label="Priority" error={errors.priority}>
          {(attributes) => (
            <Select
              id="priority"
              name="priority"
              value={priority}
              className={cn("font-medium", taskPriorityOption(priority).selectClassName)}
              onChange={(event) => {
                if (isTaskPriority(event.currentTarget.value)) {
                  setPriority(event.currentTarget.value);
                }
              }}
              required
              {...attributes}
            >
              {taskPriorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </ValidatedField>
      </div>
    </>
  );
}
