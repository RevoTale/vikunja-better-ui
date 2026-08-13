import { useMutation, useQuery } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/graphql/graphql";
import { cn } from "@/lib/cn";

export type CreationType = "one-time" | "recurring" | "job";
type CreatePayload =
  | CreateOneTimeTaskMutation["createOneTimeTask"]
  | CreateRecurringTaskMutation["createRecurringTask"]
  | CreateJobMutation["createJob"];

export function CreateTaskPage({ type, returnTo }: { type: CreationType; returnTo: string }) {
  const navigate = useNavigate();
  const { data: sessionData } = useQuery(SessionDocument);
  const { data: projectData, loading: projectsLoading } = useQuery(ProjectsDocument);
  const [createOneTime, oneTimeState] = useMutation(CreateOneTimeTaskDocument);
  const [createRecurring, recurringState] = useMutation(CreateRecurringTaskDocument);
  const [createJob, jobState] = useMutation(CreateJobDocument);
  const [repair, repairState] = useMutation(RepairTaskMetadataDocument);
  const [error, setError] = useState("");
  const [repairInfo, setRepairInfo] = useState<{
    capability: string;
    taskId: string;
    steps: readonly string[];
  }>();
  const projects = projectData?.projects.items ?? [];
  const defaultProject = projects.find((project) => project.isDefault)?.id ?? projects[0]?.id ?? "";
  const loading = oneTimeState.loading || recurringState.loading || jobState.loading;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const csrfToken = sessionData?.session.csrfToken;
    const title = text(form, "title").trim();
    const projectId = text(form, "projectId");
    const priority = Number(text(form, "priority"));
    if (!csrfToken || !title || !projectId || !Number.isInteger(priority)) {
      setError("Complete the required fields before creating the task.");
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
        payload = (
          await createJob({
            variables: {
              input: {
                csrfToken,
                title,
                description: optional(form, "description"),
                projectId,
                priority,
                startAt: text(form, "startAt"),
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
      await navigate({
        to: "/tasks/$taskId",
        params: { taskId: payload.task.id },
        search: { returnTo },
      });
    } catch {
      setError(
        "The task could not be created. Refresh the relevant list before trying again if the result is uncertain.",
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
      await navigate({
        to: "/tasks/$taskId",
        params: { taskId: payload.task.id },
        search: { returnTo },
      });
    } catch {
      setError(
        "Metadata repair did not finish. You can safely retry this repair; the task will not be created again.",
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
            variant={value === type ? "default" : "outline"}
            onClick={() =>
              navigate({ to: "/tasks/new", search: { type: value, returnTo }, replace: true })
            }
          >
            {label(value)}
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
      {projectsLoading ? (
        <p className="mt-6">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="mt-6" role="alert">
          No accessible Vikunja project is available. Create or grant access to a project first.
        </p>
      ) : (
        <form className="mt-6 grid gap-5" onSubmit={submit} noValidate>
          <SharedFields projects={projects} defaultProject={defaultProject} />
          {type === "one-time" ? (
            <OneTimeFields />
          ) : type === "recurring" ? (
            <RecurringFields />
          ) : (
            <JobFields />
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : `Create ${label(type)}`}
          </Button>
        </form>
      )}
    </section>
  );
}

function SharedFields({
  projects,
  defaultProject,
}: {
  projects: readonly { id: string; title: string }[];
  defaultProject: string;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="title">Title</FieldLabel>
        <Input id="title" name="title" required maxLength={250} />
      </Field>
      <Field>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Textarea id="description" name="description" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="projectId">Project</FieldLabel>
          <Select id="projectId" name="projectId" defaultValue={defaultProject} required>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="priority">Priority</FieldLabel>
          <Input
            id="priority"
            name="priority"
            type="number"
            min="0"
            max="5"
            defaultValue="0"
            required
          />
        </Field>
      </div>
    </>
  );
}
function OneTimeFields() {
  const [hasDueDate, setHasDueDate] = useState(false);
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="dueDate">Due date</FieldLabel>
        <Input
          id="dueDate"
          name="dueDate"
          type="date"
          onChange={(event) => setHasDueDate(Boolean(event.target.value))}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="dueTime">Due time</FieldLabel>
        <Input id="dueTime" name="dueTime" type="time" disabled={!hasDueDate} />
      </Field>
    </div>
  );
}
function RecurringFields() {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="firstDueDate">First due date</FieldLabel>
          <Input
            id="firstDueDate"
            name="firstDueDate"
            type="date"
            defaultValue={localDate()}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dueTime">Due time</FieldLabel>
          <Input id="dueTime" name="dueTime" type="time" />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="interval">Every</FieldLabel>
          <Input id="interval" name="interval" type="number" min="1" defaultValue="1" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="unit">Unit</FieldLabel>
          <Select id="unit" name="unit" defaultValue="DAY">
            <option value="DAY">Days</option>
            <option value="WEEK">Weeks</option>
            <option value="MONTH">Months</option>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="mode">Renewal</FieldLabel>
          <Select id="mode" name="mode" defaultValue="FROM_COMPLETION">
            <option value="FROM_COMPLETION">From completion</option>
            <option value="SCHEDULED_CYCLE">Scheduled cycle</option>
          </Select>
        </Field>
      </div>
    </>
  );
}
function JobFields() {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="startAt">Start time</FieldLabel>
        <Input
          id="startAt"
          name="startAt"
          type="datetime-local"
          defaultValue={`${localDate()}T09:00`}
          required
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="durationMinutes">Duration in minutes</FieldLabel>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min="1"
            defaultValue="60"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="completionWindowMinutes">Time to complete after it ends</FieldLabel>
          <Input
            id="completionWindowMinutes"
            name="completionWindowMinutes"
            type="number"
            min="1"
            defaultValue="60"
            required
          />
        </Field>
      </div>
    </>
  );
}
function text(form: FormData, name: string) {
  return String(form.get(name) ?? "");
}
function optional(form: FormData, name: string) {
  const value = text(form, name).trim();
  return value || null;
}
function label(type: CreationType) {
  return { "one-time": "one-time task", recurring: "recurring task", job: "job" }[type];
}
function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
