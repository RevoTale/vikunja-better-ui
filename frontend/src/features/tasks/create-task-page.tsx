import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { useMutation, useQuery } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import {
  CreateJobDocument,
  type CreateJobMutation,
  CreateOneTimeTaskDocument,
  type CreateOneTimeTaskMutation,
  CreateRecurringTaskDocument,
  type CreateRecurringTaskMutation,
  ProjectsDocument,
  type RecurrenceMode,
  type RecurrenceUnit,
  RepairTaskMetadataDocument,
  SessionDocument,
  type TaskPriority,
} from "@/graphql/graphql";
import { cn } from "@/lib/cn";
import { graphQLErrorMessage } from "@/lib/user-error";
import { SharedFields } from "./create-shared-fields";
import { TaskTypeFields } from "./create-type-fields";
import { defaultJobStart, jobTitlePlaceholder } from "./job-title";
import {
  composeLocalDateTime,
  currentDateInTimeZone,
  type LocalDateTimeParts,
} from "./local-date-time";
import {
  type CreationType,
  hasTaskFormErrors,
  serverTaskFormErrors,
  type TaskFormErrors,
  validateTaskForm,
} from "./task-form-validation";

type CreatePayload =
  | CreateOneTimeTaskMutation["createOneTimeTask"]
  | CreateRecurringTaskMutation["createRecurringTask"]
  | CreateJobMutation["createJob"];

export function CreateTaskPage({ type, returnTo }: { type: CreationType; returnTo: string }) {
  const navigate = useNavigate();
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
  const [createOneTime, oneTimeState] = useMutation(CreateOneTimeTaskDocument);
  const [createRecurring, recurringState] = useMutation(CreateRecurringTaskDocument);
  const [createJob, jobState] = useMutation(CreateJobDocument);
  const [repair, repairState] = useMutation(RepairTaskMetadataDocument);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<TaskFormErrors>({});
  const [jobStart, setJobStart] = useState<LocalDateTimeParts>();
  const [repairInfo, setRepairInfo] = useState<{
    capability: string;
    taskId: string;
    steps: readonly string[];
  }>();
  const projects = projectData?.projects.items ?? [];
  const timezone = sessionData?.session.vikunjaUser?.timezone;
  const defaultDate = timezone ? currentDateInTimeZone(timezone) : undefined;
  const selectedJobStart = jobStart ?? defaultJobStart(defaultDate ?? "");
  const defaultProject = projects.find((project) => project.isDefault)?.id ?? projects[0]?.id ?? "";
  const loading = oneTimeState.loading || recurringState.loading || jobState.loading;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const validationErrors = validateTaskForm(type, form);
    if (hasTaskFormErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      focusFirstInvalid(formElement, validationErrors);
      return;
    }
    setFieldErrors({});
    const csrfToken = sessionData?.session.csrfToken;
    const title = text(form, "title").trim();
    const projectId = text(form, "projectId");
    const priority = text(form, "priority") as TaskPriority;
    if (!csrfToken) {
      setError("Your session is unavailable. Refresh the page and sign in again.");
      return;
    }
    try {
      let payload: CreatePayload | undefined;
      if (type === "one-time") {
        payload = (
          await createOneTime({
            variables: {
              input: {
                csrfToken,
                title,
                description: optional(form, "description"),
                projectId,
                priority,
                dueDate: optional(form, "dueDate"),
                dueTime: optional(form, "dueTime"),
              },
            },
          })
        ).data?.createOneTimeTask;
      } else if (type === "recurring") {
        payload = (
          await createRecurring({
            variables: {
              input: {
                csrfToken,
                title,
                description: optional(form, "description"),
                projectId,
                priority,
                firstDueDate: text(form, "firstDueDate"),
                dueTime: optional(form, "dueTime"),
                interval: Number(text(form, "interval")),
                unit: text(form, "unit") as RecurrenceUnit,
                mode: text(form, "mode") as RecurrenceMode,
              },
            },
          })
        ).data?.createRecurringTask;
      } else {
        const startAt = composeLocalDateTime({
          date: text(form, "startDate"),
          time: text(form, "startTime"),
        });
        if (!startAt) {
          const errors = validateTaskForm(type, form);
          setFieldErrors(errors);
          focusFirstInvalid(formElement, errors);
          return;
        }
        payload = (
          await createJob({
            variables: {
              input: {
                csrfToken,
                title: title || null,
                description: optional(form, "description"),
                projectId,
                priority,
                startAt,
                durationMinutes: Number(text(form, "durationMinutes")),
                completionWindowMinutes: Number(text(form, "completionWindowMinutes")),
              },
            },
          })
        ).data?.createJob;
      }
      if (!payload) throw new Error("empty result");
      if (payload.status === "REPAIR_REQUIRED" && payload.repairCapability) {
        setRepairInfo({
          capability: payload.repairCapability,
          taskId: payload.task.id,
          steps: payload.remainingRepairSteps,
        });
        return;
      }
      try {
        await navigate({
          to: "/tasks/$taskId",
          params: { taskId: payload.task.id },
          search: { returnTo },
        });
      } catch {
        setError(
          "The task was created, but its page could not be opened. Return to the task list.",
        );
      }
    } catch (caught) {
      const validationMessage = graphQLValidationMessage(caught);
      const serverErrors = validationMessage
        ? serverTaskFormErrors(type, form, validationMessage)
        : {};
      if (hasTaskFormErrors(serverErrors)) {
        setFieldErrors(serverErrors);
        focusFirstInvalid(formElement, serverErrors);
        return;
      }
      setError(
        graphQLErrorMessage(
          caught,
          "The task could not be created. Refresh the relevant list before trying again if the result is uncertain.",
        ),
      );
    }
  }

  async function continueRepair() {
    const csrfToken = sessionData?.session.csrfToken;
    if (!csrfToken || !repairInfo) return;
    try {
      const payload = (
        await repair({ variables: { input: { csrfToken, capability: repairInfo.capability } } })
      ).data?.repairTaskMetadata;
      if (!payload) throw new Error("empty result");
      if (payload.status === "REPAIR_REQUIRED" && payload.repairCapability) {
        setRepairInfo({
          capability: payload.repairCapability,
          taskId: payload.task.id,
          steps: payload.remainingRepairSteps,
        });
        return;
      }
      try {
        await navigate({
          to: "/tasks/$taskId",
          params: { taskId: payload.task.id },
          search: { returnTo },
        });
      } catch {
        setError(
          "Metadata repair finished, but the task page could not be opened. Return to the task list.",
        );
      }
    } catch (caught) {
      setError(
        graphQLErrorMessage(
          caught,
          "Metadata repair did not finish. You can safely retry this repair; the task will not be created again.",
        ),
      );
    }
  }

  if (repairInfo)
    return (
      <section>
        <h1 className="font-serif text-3xl font-semibold">Task created; metadata needs repair</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The task exists in Vikunja. Continue the idempotent repair instead of submitting the form
          again.
        </p>
        <p className="mt-4 text-sm">Remaining: {repairInfo.steps.join(", ")}</p>
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="mt-5" onClick={continueRepair} disabled={repairState.loading}>
          {repairState.loading ? "Repairing…" : "Continue repair"}
        </Button>
      </section>
    );

  return (
    <section className="mx-auto max-w-2xl">
      <a
        href={returnTo}
        className={cn(buttonVariants({ variant: "ghost", size: "compact" }), "mb-4 px-0")}
      >
        <ArrowLeft /> Back
      </a>
      <h1 className="font-serif text-3xl font-semibold">New {label(type)}</h1>
      <fieldset className="mt-4 grid grid-cols-3 gap-2">
        <legend className="sr-only">Task type</legend>
        {(["one-time", "recurring", "job"] as const).map((value) => (
          <Button
            key={value}
            aria-label={label(value)}
            aria-pressed={value === type}
            variant={value === type ? "default" : "outline"}
            className="min-w-0 whitespace-nowrap px-2"
            onClick={() => {
              setError("");
              setFieldErrors({});
              return navigate({
                to: "/tasks/new",
                search: { type: value, returnTo },
                replace: true,
              });
            }}
          >
            {shortLabel(value)}
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
      {sessionLoading || projectsLoading ? (
        <p className="mt-6">Loading task settings…</p>
      ) : sessionError || projectsError ? (
        <p className="mt-6 text-destructive" role="alert">
          {graphQLErrorMessage(
            sessionError ?? projectsError,
            "Task settings could not be loaded. Refresh the page and try again.",
          )}
        </p>
      ) : !timezone || !defaultDate ? (
        <p className="mt-6" role="alert">
          Configure a valid timezone in Vikunja before creating tasks.
        </p>
      ) : projects.length === 0 ? (
        <p className="mt-6" role="alert">
          No accessible Vikunja project is available. Create or grant access to a project first.
        </p>
      ) : (
        <form
          className="mt-6 grid gap-5"
          onSubmit={submit}
          onChange={(event) => {
            if (hasTaskFormErrors(fieldErrors)) {
              setFieldErrors(validateTaskForm(type, new FormData(event.currentTarget)));
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
            onJobStartChange={setJobStart}
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : `Create ${label(type)}`}
          </Button>
        </form>
      )}
    </section>
  );
}

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "");
}
function optional(form: FormData, name: string) {
  const value = text(form, name).trim();
  return value || null;
}
function focusFirstInvalid(form: HTMLFormElement, errors: TaskFormErrors) {
  const firstName = Object.keys(errors)[0];
  if (!firstName) return;
  const field =
    form.querySelector<HTMLElement>(`[data-form-field="${firstName}"]`) ??
    form.elements.namedItem(firstName);
  if (field instanceof HTMLElement) requestAnimationFrame(() => field.focus());
}
function graphQLValidationMessage(error: unknown): string | undefined {
  if (!CombinedGraphQLErrors.is(error)) return undefined;
  return error.errors.find((item) => {
    const code = item.extensions?.code;
    return code === "VALIDATION_FAILED" || code === "FORBIDDEN";
  })?.message;
}
function label(type: CreationType) {
  return { "one-time": "one-time task", recurring: "recurring task", job: "job" }[type];
}
function shortLabel(type: CreationType) {
  return { "one-time": "One-time", recurring: "Recurring", job: "Job" }[type];
}
