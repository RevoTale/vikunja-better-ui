import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import type { ProjectsQuery } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { SharedFields } from "./create-shared-fields";
import { TaskTypeFields } from "./create-type-fields";
import { taskTypeLabel } from "./creation-type";
import { jobTitlePlaceholder } from "./job-title";
import type { LocalDateTimeParts } from "./local-date-time";
import {
  type CreationType,
  hasTaskFormErrors,
  type TaskFormErrors,
  validateTaskForm,
} from "./task-form-validation";

export function CreateTaskForm({
  type,
  projects,
  defaultProject,
  timezone,
  defaultDate,
  selectedJobStart,
  fieldErrors,
  loading,
  settingsLoading,
  settingsError,
  onSubmit,
  onFieldErrorsChange,
  onJobStartChange,
}: {
  type: CreationType;
  projects: ProjectsQuery["projects"]["items"];
  defaultProject: string;
  timezone: string | null | undefined;
  defaultDate: string | undefined;
  selectedJobStart: LocalDateTimeParts;
  fieldErrors: TaskFormErrors;
  loading: boolean;
  settingsLoading: boolean;
  settingsError: unknown;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFieldErrorsChange: (errors: TaskFormErrors) => void;
  onJobStartChange: (value: LocalDateTimeParts) => void;
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
    <form
      className="mt-6 grid gap-5"
      onSubmit={onSubmit}
      onChange={(event) => {
        if (hasTaskFormErrors(fieldErrors)) {
          onFieldErrorsChange(validateTaskForm(type, new FormData(event.currentTarget)));
        }
      }}
      noValidate
    >
      <SharedFields
        projects={projects}
        defaultProject={defaultProject}
        errors={fieldErrors}
        type={type}
        titlePlaceholder={jobTitlePlaceholder(selectedJobStart)}
      />
      <TaskTypeFields
        type={type}
        errors={fieldErrors}
        defaultDate={defaultDate}
        jobStart={selectedJobStart}
        onJobStartChange={onJobStartChange}
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Creating…" : `Create ${taskTypeLabel(type)}`}
      </Button>
    </form>
  );
}
