import { AppInput } from "@/components/app-input";
import { AppSelect } from "@/components/app-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type {
  ChangeTaskCreationAutofillField,
  TaskCreationAutofillField,
  TaskCreationValues,
} from "./autofill/task-creation-autofill";
import type { CreationBaseType, TaskFormErrors } from "./task-form-validation";
import { taskPriorityOption, taskPriorityOptions } from "./task-priority";
import { ValidatedField } from "./validated-field";

export function SharedFields({
  projects,
  errors,
  type,
  titlePlaceholder,
  values,
  autofilled,
  onFieldChange,
}: {
  projects: readonly { id: string; title: string }[];
  errors: TaskFormErrors;
  type: CreationBaseType;
  titlePlaceholder: string;
  values: TaskCreationValues;
  autofilled: ReadonlySet<TaskCreationAutofillField>;
  onFieldChange: ChangeTaskCreationAutofillField;
}) {
  return (
    <>
      <ValidatedField
        name="title"
        label={values.job && type !== "recurring" ? "Title (optional)" : "Title"}
        error={errors.title}
        autofilled={autofilled.has("title")}
      >
        {(attributes) => (
          <AppInput
            id="title"
            name="title"
            autoFocus
            required={!values.job || type === "recurring"}
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
        <Textarea id="description" name="description" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <ValidatedField
          name="projectId"
          label="Project"
          error={errors.projectId}
          autofilled={autofilled.has("projectId")}
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
          autofilled={autofilled.has("priority")}
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
