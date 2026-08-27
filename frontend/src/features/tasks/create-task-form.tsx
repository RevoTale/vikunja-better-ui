import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import type { ProjectsQuery } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { AutofillIndicator } from "./autofill/autofill-indicator";
import { useTaskCreationAutofill } from "./autofill/use-task-creation-autofill";
import { SharedFields } from "./create-shared-fields";
import { TaskTypeFields } from "./create-type-fields";
import { taskTypeLabel } from "./creation-type";
import { jobTitlePlaceholder } from "./job-title";
import type { LocalDateTimeParts } from "./local-date-time";
import {
  type CreationBaseType,
  hasTaskFormErrors,
  type TaskFormErrors,
  validateTaskForm,
} from "./task-form-validation";

export function CreateTaskForm({
  type,
  initialJob,
  projects,
  defaultProject,
  explicitProjectId,
  timezone,
  defaultDate,
  initialDate,
  selectedJobStart,
  fieldErrors,
  loading,
  settingsLoading,
  settingsError,
  onSubmit,
  onFieldErrorsChange,
}: {
  type: CreationBaseType;
  initialJob: boolean;
  projects: ProjectsQuery["projects"]["items"];
  defaultProject: string;
  explicitProjectId: string | undefined;
  timezone: string | null | undefined;
  defaultDate: string | undefined;
  initialDate: string | undefined;
  selectedJobStart: LocalDateTimeParts;
  fieldErrors: TaskFormErrors;
  loading: boolean;
  settingsLoading: boolean;
  settingsError: unknown;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFieldErrorsChange: (errors: TaskFormErrors) => void;
}) {
  if (settingsLoading) return <p className="mt-6">Loading task settings…</p>;
  if (settingsError) {
    return (
      <p className="mt-6 text-destructive" role="alert">
        {graphQLErrorMessage(
          settingsError,
          "Task settings could not be loaded. Refresh the page and try again.",
        )}
      </p>
    );
  }
  if (!timezone || !defaultDate) {
    return (
      <p className="mt-6" role="alert">
        Configure a valid timezone in Vikunja before creating tasks.
      </p>
    );
  }
  if (projects.length === 0) {
    return (
      <p className="mt-6" role="alert">
        No accessible Vikunja project is available. Create or grant access to a project first.
      </p>
    );
  }
  return (
    <ReadyCreateTaskForm
      key={`${type}:${initialJob}:${initialDate ?? ""}:${explicitProjectId ?? ""}`}
      type={type}
      initialJob={initialJob}
      projects={projects}
      defaultProject={defaultProject}
      explicitProjectId={explicitProjectId}
      defaultDate={defaultDate}
      initialDate={initialDate}
      selectedJobStart={selectedJobStart}
      fieldErrors={fieldErrors}
      loading={loading}
      onSubmit={onSubmit}
      onFieldErrorsChange={onFieldErrorsChange}
    />
  );
}

function ReadyCreateTaskForm({
  type,
  initialJob,
  projects,
  defaultProject,
  explicitProjectId,
  defaultDate,
  initialDate,
  selectedJobStart,
  fieldErrors,
  loading,
  onSubmit,
  onFieldErrorsChange,
}: {
  type: CreationBaseType;
  initialJob: boolean;
  projects: ProjectsQuery["projects"]["items"];
  defaultProject: string;
  explicitProjectId: string | undefined;
  defaultDate: string;
  initialDate: string | undefined;
  selectedJobStart: LocalDateTimeParts;
  fieldErrors: TaskFormErrors;
  loading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFieldErrorsChange: (errors: TaskFormErrors) => void;
}) {
  const { state, changeField, changeVariant } = useTaskCreationAutofill({
    baseType: type,
    defaultDate,
    defaultProjectId: defaultProject,
    defaultJobStart: selectedJobStart,
    accessibleProjectIds: projects.map((project) => String(project.id)),
    ...(initialDate ? { explicitDate: initialDate } : {}),
    ...(explicitProjectId ? { explicitProjectId } : {}),
    ...(initialJob ? { explicitJob: true } : {}),
  });
  const { values, autofilled } = state;

  return (
    <form
      className="mt-6 grid gap-5"
      onSubmit={onSubmit}
      onInput={(event) => {
        if (hasTaskFormErrors(fieldErrors)) {
          onFieldErrorsChange(validateTaskForm(type, new FormData(event.currentTarget)));
        }
      }}
      noValidate
    >
      <SharedFields
        projects={projects}
        errors={fieldErrors}
        type={type}
        titlePlaceholder={jobTitlePlaceholder({
          date: values.startDate,
          time: values.startTime,
        })}
        values={values}
        autofilled={autofilled}
        onFieldChange={changeField}
      />
      <div className="rounded-md border bg-muted/30 p-4">
        <label className="flex cursor-pointer items-start gap-3" htmlFor="job">
          <input
            id="job"
            name="job"
            type="checkbox"
            checked={values.job}
            onChange={(event) => changeVariant(event.currentTarget.checked)}
            className="mt-1 size-4 accent-primary"
            aria-label="Job"
            aria-describedby={
              autofilled.has("job") ? "job-description job-autofill" : "job-description"
            }
          />
          <span>
            <span className="block text-sm font-medium">Job</span>
            <span id="job-description" className="mt-1 block text-sm text-muted-foreground">
              Add a start, duration, and completion window.
            </span>
          </span>
        </label>
        {autofilled.has("job") ? (
          <div className="mt-1 pl-7">
            <AutofillIndicator id="job-autofill" />
          </div>
        ) : null}
      </div>
      <TaskTypeFields
        type={type}
        errors={fieldErrors}
        defaultDate={defaultDate}
        values={values}
        autofilled={autofilled}
        onFieldChange={changeField}
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Creating…" : creationButtonLabel(type, values.job)}
      </Button>
    </form>
  );
}

function creationButtonLabel(type: CreationBaseType, isJob: boolean): string {
  if (!isJob) return `Create ${taskTypeLabel(type)}`;
  return type === "recurring" ? "Create recurring Job" : "Create job";
}
