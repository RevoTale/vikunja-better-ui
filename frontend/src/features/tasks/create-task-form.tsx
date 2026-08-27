import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ProjectsQuery } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
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
  onJobStartChange,
}: {
  type: CreationBaseType;
  initialJob: boolean;
  projects: ProjectsQuery["projects"]["items"];
  defaultProject: string;
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
  onJobStartChange: (value: LocalDateTimeParts) => void;
}) {
  const [isJob, setIsJob] = useState(initialJob);
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
      onInput={(event) => {
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
        isJob={isJob}
        titlePlaceholder={jobTitlePlaceholder(selectedJobStart)}
      />
      <div className="rounded-md border bg-muted/30 p-4">
        <label className="flex cursor-pointer items-start gap-3" htmlFor="job">
          <input
            id="job"
            name="job"
            type="checkbox"
            checked={isJob}
            onChange={(event) => setIsJob(event.currentTarget.checked)}
            className="mt-1 size-4 accent-primary"
            aria-label="Job"
            aria-describedby="job-description"
          />
          <span>
            <span className="block text-sm font-medium">Job</span>
            <span id="job-description" className="mt-1 block text-sm text-muted-foreground">
              Add a start, duration, and completion window.
            </span>
          </span>
        </label>
      </div>
      <TaskTypeFields
        type={type}
        isJob={isJob}
        errors={fieldErrors}
        defaultDate={defaultDate}
        initialDate={initialDate}
        jobStart={selectedJobStart}
        onJobStartChange={onJobStartChange}
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Creating…" : creationButtonLabel(type, isJob)}
      </Button>
    </form>
  );
}

function creationButtonLabel(type: CreationBaseType, isJob: boolean): string {
  if (!isJob) return `Create ${taskTypeLabel(type)}`;
  return type === "recurring" ? "Create recurring Job" : "Create job";
}
