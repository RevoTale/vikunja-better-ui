import { useQuery } from "@apollo/client/react";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { ProjectsDocument, SessionDocument } from "@/graphql/graphql";
import { cn } from "@/lib/utils";
import { CreateTaskForm } from "./create-task-form";
import { CreationLabelWarningPanel, CreationRepairPanel } from "./creation-outcome";
import { shortTaskTypeLabel, taskTypeLabel } from "./creation-type";
import { defaultJobStart } from "./job-title";
import { currentDateInTimeZone } from "./local-date-time";
import {
  type CreationBaseType,
  type CreationType,
  hasTaskFormErrors,
} from "./task-form-validation";
import { useCreatedTaskResult } from "./use-created-task-result";
import { useTaskCreation } from "./use-task-creation";

export function CreateTaskPage({
  type,
  returnTo,
  date: initialDate,
  project: initialProjectID,
}: {
  type: CreationType;
  returnTo: string;
  date?: string;
  project?: string;
}) {
  const {
    projects,
    timezone,
    defaultDate,
    selectedJobStart,
    defaultProject,
    csrfToken,
    settingsLoading,
    settingsError,
  } = useCreationSettings(initialProjectID, initialDate);
  const result = useCreatedTaskResult(csrfToken, returnTo);
  const { error, setError, labelWarning, repairInfo, repairing, continueRepair } = result;
  const [baseType, setBaseType] = useState<CreationBaseType>(type === "job" ? "one-time" : type);
  const { loading, fieldErrors, setFieldErrors, submit } = useTaskCreation(
    baseType,
    csrfToken,
    result.acceptCreated,
    setError,
  );

  if (repairInfo)
    return (
      <CreationRepairPanel
        repairInfo={repairInfo}
        error={error}
        repairing={repairing}
        continueRepair={continueRepair}
      />
    );
  if (labelWarning)
    return <CreationLabelWarningPanel labelWarning={labelWarning} returnTo={returnTo} />;

  return (
    <section className="mx-auto max-w-2xl">
      <a
        href={returnTo}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4 px-0")}
      >
        <ArrowLeft /> Back
      </a>
      <h1 className="font-serif text-3xl font-semibold">New {taskTypeLabel(baseType)}</h1>
      <fieldset className="mt-4 grid grid-cols-2 gap-2">
        <legend className="sr-only">Task type</legend>
        {(["one-time", "recurring"] as const).map((value) => (
          <Button
            key={value}
            aria-label={taskTypeLabel(value)}
            aria-pressed={value === baseType}
            variant={value === baseType ? "default" : "outline"}
            className="min-w-0 whitespace-nowrap px-2"
            onClick={() => {
              if (value === baseType) return;
              setError("");
              setFieldErrors({});
              setBaseType(value);
            }}
          >
            {shortTaskTypeLabel(value)}
          </Button>
        ))}
      </fieldset>
      {error ? (
        <div
          className="mt-5 rounded-md border border-destructive/40 bg-destructive/5 p-3"
          role="alert"
        >
          <FieldError>{error}</FieldError>
        </div>
      ) : null}
      {hasTaskFormErrors(fieldErrors) ? (
        <div
          className="mt-5 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          Check the highlighted fields below.
        </div>
      ) : null}
      <CreateTaskForm
        type={baseType}
        initialJob={type === "job"}
        projects={projects}
        defaultProject={defaultProject}
        explicitProjectId={initialProjectID}
        timezone={timezone}
        defaultDate={defaultDate}
        initialDate={initialDate}
        selectedJobStart={selectedJobStart}
        fieldErrors={fieldErrors}
        loading={loading}
        settingsLoading={settingsLoading}
        settingsError={settingsError}
        onSubmit={submit}
        onFieldErrorsChange={setFieldErrors}
      />
    </section>
  );
}

function useCreationSettings(
  initialProjectID: string | undefined,
  initialDate: string | undefined,
) {
  const {
    data: sessionData,
    loading: sessionLoading,
    error: sessionError,
  } = useQuery(SessionDocument);
  const {
    data: projectData,
    loading: projectsLoading,
    error: projectsError,
  } = useQuery(ProjectsDocument);
  const projects = projectData?.projects.items ?? [];
  const timezone = sessionData?.session.vikunjaUser?.timezone;
  const defaultDate = timezone ? currentDateInTimeZone(timezone) : undefined;
  const selectedJobStart = defaultJobStart(initialDate ?? defaultDate ?? "");
  const defaultProject = String(
    projects.find((project) => String(project.id) === initialProjectID)?.id ??
      projects.find((project) => project.isDefault)?.id ??
      projects[0]?.id ??
      "",
  );

  return {
    projects,
    timezone,
    defaultDate,
    selectedJobStart,
    defaultProject,
    csrfToken: sessionData?.session.csrfToken,
    settingsLoading: sessionLoading || projectsLoading,
    settingsError: sessionError ?? projectsError,
  };
}
