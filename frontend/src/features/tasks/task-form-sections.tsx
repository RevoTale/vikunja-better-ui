import { type ReactNode, useState } from "react";
import { AppInput } from "@/components/app-input";
import { AppSelect } from "@/components/app-select";
import { Button } from "@/components/ui/button";
import type { TaskCreationValues } from "./task-creation-values";
import { TaskDescriptionField } from "./task-description-field";
import { TaskFormSection } from "./task-form-section";
import type { CreationBaseType, TaskFormErrors } from "./task-form-validation";
import type { TaskLabel } from "./task-label-options";
import { TaskLabelFields } from "./task-label-picker";
import { taskPriorityOption, taskPriorityOptions } from "./task-priority";
import { ReuseValueButton, useTaskReuseValues } from "./task-reuse";
import { useTaskLabelPicker } from "./use-task-label-picker";
import { ValidatedField } from "./validated-field";

type FieldsProps = {
  projects: readonly { id: string; title: string }[];
  errors: TaskFormErrors;
  values: Pick<TaskCreationValues, "job" | "title" | "projectId" | "priority">;
  onFieldChange: <Field extends "title" | "projectId" | "priority" | "job">(
    field: Field,
    value: TaskCreationValues[Field],
  ) => void;
};

export function TaskFormSections({
  projects,
  errors,
  type,
  titlePlaceholder,
  values,
  onFieldChange,
  description,
  disabled = false,
  titleRequired = false,
  children,
  initialLabels,
  onLabelsPending,
}: FieldsProps & {
  type: CreationBaseType;
  titlePlaceholder: string;
  initialLabels: readonly TaskLabel[];
  onLabelsPending: (pending: boolean) => void;
  description?: string;
  disabled?: boolean;
  titleRequired?: boolean;
  children: ReactNode;
}) {
  const previous = useTaskReuseValues();
  const picker = useTaskLabelPicker(initialLabels, onLabelsPending);
  const [editingLabels, setEditingLabels] = useState(false);
  return (
    <>
      <TaskFormSection title="Task">
        <ValidatedField
          name="title"
          label={
            !titleRequired && values.job && type !== "recurring" ? "Title (optional)" : "Title"
          }
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
        <TaskDescriptionField initialHtml={description ?? ""} disabled={disabled} />
        <OrganizationFields
          projects={projects}
          values={values}
          errors={errors}
          onFieldChange={onFieldChange}
        />
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            name="job"
            type="checkbox"
            checked={values.job}
            disabled={disabled}
            onChange={(event) => onFieldChange("job", event.currentTarget.checked)}
            className="size-4 accent-primary"
          />
          Schedule a timed session
        </label>
      </TaskFormSection>
      <TaskFormSection title="Plan">{children}</TaskFormSection>
      <TaskFormSection title="Labels">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {picker.selected.map((label) => (
            <span
              key={label.id}
              className="max-w-full rounded-md bg-muted px-2 py-1 text-xs wrap-anywhere"
            >
              {label.title}
            </span>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={editingLabels}
            onClick={() => setEditingLabels(!editingLabels)}
          >
            {editingLabels
              ? "Done editing labels"
              : picker.selected.length
                ? "Edit or create labels"
                : "Add or create labels"}
          </Button>
        </div>
        <div hidden={!editingLabels}>
          <TaskLabelFields picker={picker} showEstimateHint={type === "one-time" && !values.job} />
        </div>
      </TaskFormSection>
    </>
  );
}

function OrganizationFields({ projects, errors, values, onFieldChange }: FieldsProps) {
  const previous = useTaskReuseValues();
  const previousProject = projects.find((project) => project.id === previous?.projectId);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
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
  );
}
