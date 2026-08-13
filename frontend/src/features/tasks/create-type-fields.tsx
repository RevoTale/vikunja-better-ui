import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { JobStartFields } from "./job-start-fields";
import { currentLocalDate, type LocalDateTimeParts } from "./local-date-time";
import type { CreationType, TaskFormErrors } from "./task-form-validation";
import { ValidatedField } from "./validated-field";

export function TaskTypeFields({
  type,
  errors,
  jobStart,
  onJobStartChange,
}: {
  type: CreationType;
  errors: TaskFormErrors;
  jobStart: LocalDateTimeParts;
  onJobStartChange: (value: LocalDateTimeParts) => void;
}) {
  if (type === "one-time") return <OneTimeFields errors={errors} />;
  if (type === "recurring") return <RecurringFields errors={errors} />;
  return <JobFields errors={errors} start={jobStart} onStartChange={onJobStartChange} />;
}

function OneTimeFields({ errors }: { errors: TaskFormErrors }) {
  const [hasDueDate, setHasDueDate] = useState(false);
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <ValidatedField name="dueDate" label="Due date" error={errors.dueDate}>
        {(attributes) => (
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            onChange={(event) => setHasDueDate(Boolean(event.target.value))}
            {...attributes}
          />
        )}
      </ValidatedField>
      <ValidatedField name="dueTime" label="Due time" error={errors.dueTime}>
        {(attributes) => (
          <Input id="dueTime" name="dueTime" type="time" disabled={!hasDueDate} {...attributes} />
        )}
      </ValidatedField>
    </div>
  );
}

function RecurringFields({ errors }: { errors: TaskFormErrors }) {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <ValidatedField name="firstDueDate" label="First due date" error={errors.firstDueDate}>
          {(attributes) => (
            <Input
              id="firstDueDate"
              name="firstDueDate"
              type="date"
              defaultValue={currentLocalDate()}
              required
              {...attributes}
            />
          )}
        </ValidatedField>
        <ValidatedField name="dueTime" label="Due time" error={errors.dueTime}>
          {(attributes) => <Input id="dueTime" name="dueTime" type="time" {...attributes} />}
        </ValidatedField>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <ValidatedField name="interval" label="Every" error={errors.interval}>
          {(attributes) => (
            <Input
              id="interval"
              name="interval"
              type="number"
              min="1"
              defaultValue="1"
              required
              {...attributes}
            />
          )}
        </ValidatedField>
        <ValidatedField name="unit" label="Unit" error={errors.unit}>
          {(attributes) => (
            <Select id="unit" name="unit" defaultValue="DAY" {...attributes}>
              <option value="DAY">Days</option>
              <option value="WEEK">Weeks</option>
              <option value="MONTH">Months</option>
            </Select>
          )}
        </ValidatedField>
        <ValidatedField name="mode" label="Renewal" error={errors.mode}>
          {(attributes) => (
            <Select id="mode" name="mode" defaultValue="FROM_COMPLETION" {...attributes}>
              <option value="FROM_COMPLETION">From completion</option>
              <option value="SCHEDULED_CYCLE">Scheduled cycle</option>
            </Select>
          )}
        </ValidatedField>
      </div>
    </>
  );
}

function JobFields({
  errors,
  start,
  onStartChange,
}: {
  errors: TaskFormErrors;
  start: LocalDateTimeParts;
  onStartChange: (value: LocalDateTimeParts) => void;
}) {
  return (
    <>
      <JobStartFields value={start} errors={errors} onChange={onStartChange} />
      <div className="grid gap-5 sm:grid-cols-2">
        <ValidatedField
          name="durationMinutes"
          label="Duration in minutes"
          error={errors.durationMinutes}
        >
          {(attributes) => (
            <Input
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              min="1"
              defaultValue="60"
              required
              {...attributes}
            />
          )}
        </ValidatedField>
        <ValidatedField
          name="completionWindowMinutes"
          label="Time to complete after it ends"
          error={errors.completionWindowMinutes}
        >
          {(attributes) => (
            <Input
              id="completionWindowMinutes"
              name="completionWindowMinutes"
              type="number"
              min="1"
              defaultValue="60"
              required
              {...attributes}
            />
          )}
        </ValidatedField>
      </div>
    </>
  );
}
