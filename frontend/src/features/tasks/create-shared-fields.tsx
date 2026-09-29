import { AppInput } from "@/components/app-input";
import { AppSelect } from "@/components/app-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { TaskCreationValues } from "./task-creation-values";
import type { CreationBaseType, TaskFormErrors } from "./task-form-validation";
import { taskPriorityOption, taskPriorityOptions } from "./task-priority";
import { ReuseValueButton, useTaskReuseValues } from "./task-reuse";
import { ValidatedField } from "./validated-field";

export function SharedFields({
  projects,
  errors,
  type,
  titlePlaceholder,
  values,
  onFieldChange,
  description,
  titleRequired = false,
}: {
  projects: readonly { id: string; title: string }[];
  errors: TaskFormErrors;
  type: CreationBaseType;
  titlePlaceholder: string;
  values: Pick<TaskCreationValues, "job" | "title" | "projectId" | "priority">;
  onFieldChange: <Field extends "title" | "projectId" | "priority">(
    field: Field,
    value: TaskCreationValues[Field],
  ) => void;
  description?: string;
  titleRequired?: boolean;
}) {
  const previous = useTaskReuseValues();
  const previousProject = projects.find((project) => project.id === previous?.projectId);
  return (
    <>
      <ValidatedField
        name="title"
        label={!titleRequired && values.job && type !== "recurring" ? "Title (optional)" : "Title"}
        error={errors.title}
        action={
          <ReuseValueButton
            label="title"
            value={previous?.title}
            onApply={() => {
              if (previous) onFieldChange("title", previous.title);
            }}
          />
        }
      >
        {(attributes) => (
          <AppInput
            id="title"
            name="title"
            autoFocus
            required={titleRequired || !values.job || type === "recurring"}
            placeholder={values.job && type !== "recurring" ? titlePlaceholder : undefined}
            maxLength={250}
            value={values.title}
            onChange={(event) => onFieldChange("title", event.currentTarget.value)}
            {...attributes}
          />
        )}
      </ValidatedField>
      <Field>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Textarea id="description" name="description" defaultValue={description} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <ValidatedField
          name="projectId"
          label="Project"
          error={errors.projectId}
          action={
            <ReuseValueButton
              label="project"
              value={previousProject?.title}
              onApply={() => {
                if (previousProject) onFieldChange("projectId", previousProject.id);
              }}
            />
          }
        >
          {(attributes) => (
            <AppSelect
              id="projectId"
              name="projectId"
              value={values.projectId}
              options={projects.map((project) => ({
                value: String(project.id),
                label: project.title,
              }))}
              onValueChange={(projectId) => onFieldChange("projectId", projectId)}
              required
              {...attributes}
            />
          )}
        </ValidatedField>
        <ValidatedField
          name="priority"
          label="Priority"
          error={errors.priority}
          action={
            <ReuseValueButton
              label="priority"
              value={previous ? taskPriorityOption(previous.priority).label : null}
              onApply={() => {
                if (previous) onFieldChange("priority", previous.priority);
              }}
            />
          }
        >
          {(attributes) => (
            <AppSelect
              id="priority"
              name="priority"
              value={values.priority}
              className={taskPriorityOption(values.priority).selectClassName}
              options={taskPriorityOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onValueChange={(nextPriority) => {
                onFieldChange("priority", nextPriority);
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
