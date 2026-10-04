import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ProjectsQuery } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { SharedFields } from "./create-shared-fields";
import { TaskTypeFields } from "./create-type-fields";
import { taskTypeLabel } from "./creation-type";
import { jobTitlePlaceholder } from "./job-title";
import type { LocalDateTimeParts } from "./local-date-time";
import { ScheduleShift } from "./schedule-shift";
import { type ChangeTaskCreationField, defaultTaskCreationValues } from "./task-creation-values";
import {
  type CreationBaseType,
  hasTaskFormErrors,
  type TaskFormErrors,
  validateTaskForm,
} from "./task-form-validation";
import { TaskLabelPicker } from "./task-label-picker";
import { TaskReuseProvider } from "./task-reuse";

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
  const hasSettings = Boolean(timezone && defaultDate && projects.length > 0);
  if (settingsLoading && !hasSettings) return <p className="mt-6">Loading task settings…</p>;
  if (settingsError && !hasSettings) {
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
      key={`${initialDate ?? ""}:${explicitProjectId ?? ""}`}
      type={type}
      initialJob={initialJob}
      projects={projects}
      timezone={timezone}
      defaultProject={defaultProject}
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
  timezone,
  type,
  initialJob,
  projects,
  defaultProject,
  defaultDate,
  initialDate,
  selectedJobStart,
  fieldErrors,
  loading,
  onSubmit,
  onFieldErrorsChange,
}: {
  timezone: string;
  type: CreationBaseType;
  initialJob: boolean;
  projects: ProjectsQuery["projects"]["items"];
  defaultProject: string;
  defaultDate: string;
  initialDate: string | undefined;
  selectedJobStart: LocalDateTimeParts;
  fieldErrors: TaskFormErrors;
  loading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFieldErrorsChange: (errors: TaskFormErrors) => void;
}) {
  const [labelsPending, setLabelsPending] = useState(false);
  const [values, setValues] = useState(() =>
    defaultTaskCreationValues({
      job: initialJob,
      projectId: defaultProject,
      today: defaultDate,
      date: initialDate,
      jobStart: selectedJobStart,
    }),
  );
  const changeField: ChangeTaskCreationField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  return (
    <form
      className="mt-6 grid min-w-0 grid-cols-1 gap-5"
      onSubmit={(event) => {
        if (labelsPending) event.preventDefault();
        else onSubmit(event);
      }}
      onInput={(event) => {
        if (hasTaskFormErrors(fieldErrors)) {
          onFieldErrorsChange(validateTaskForm(type, new FormData(event.currentTarget)));
        }
      }}
      noValidate
    >
      <div className="rounded-md border bg-muted/30 p-4">
        <label className="flex cursor-pointer items-start gap-3" htmlFor="job">
          <input
            id="job"
            name="job"
            type="checkbox"
            checked={values.job}
            onChange={(event) => changeField("job", event.currentTarget.checked)}
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
      <TaskReuseProvider job={values.job} recurring={type === "recurring"}>
        <SharedFields
          disabled={loading}
          projects={projects}
          errors={fieldErrors}
          type={type}
          titlePlaceholder={jobTitlePlaceholder({ date: values.startDate, time: values.startTime })}
          values={values}
          onFieldChange={changeField}
        />
        <TaskTypeFields
          type={type}
          errors={fieldErrors}
          defaultDate={defaultDate}
          values={values}
          onFieldChange={changeField}
        />
        <ScheduleShift
          timezone={timezone}
          fields={
            values.job
              ? { start: `${values.startDate}T${values.startTime}` }
              : {
                  due: `${type === "recurring" ? values.firstDueDate : values.dueDate}${values.dueTime ? `T${values.dueTime}` : ""}`,
                }
          }
          onChange={(next) => {
            if (values.job && next.start) {
              changeField("startDate", next.start.slice(0, 10));
              changeField("startTime", next.start.slice(11));
            } else if (next.due) {
              changeField(type === "recurring" ? "firstDueDate" : "dueDate", next.due.slice(0, 10));
              changeField("dueTime", next.due.slice(11));
            }
          }}
        />
        <TaskLabelPicker onPendingChange={setLabelsPending} />
      </TaskReuseProvider>
      <Button type="submit" disabled={loading || labelsPending}>
        {loading ? "Creating…" : creationButtonLabel(type, values.job)}
      </Button>
    </form>
  );
}

function creationButtonLabel(type: CreationBaseType, isJob: boolean): string {
  if (!isJob) return `Create ${taskTypeLabel(type)}`;
  return type === "recurring" ? "Create recurring Job" : "Create job";
}
