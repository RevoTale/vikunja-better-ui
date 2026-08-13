import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DateInputDayFirst } from "./date-input-day-first";
import { JobStartFields } from "./job-start-fields";
import { currentLocalDate, type LocalDateTimeParts } from "./local-date-time";
import type { CreationType, TaskFormErrors } from "./task-form-validation";
import { TimeInput24 } from "./time-input-24";
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
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <ValidatedField name="dueDate" label="Due date" error={errors.dueDate}>
        {(attributes) => (
          <DateInputDayFirst
            id="dueDate"
            name="dueDate"
            monthLabel="Due date month"
            yearLabel="Due date year"
            value={dueDate}
            onChange={(value) => {
              setDueDate(value);
              setHasDueDate(Boolean(value));
            }}
            {...attributes}
          />
        )}
      </ValidatedField>
      <ValidatedField name="dueTime" label="Due time" error={errors.dueTime}>
        {(attributes) => (
          <TimeInput24
            id="dueTime"
            name="dueTime"
            minuteLabel="Due time minute"
            value={dueTime}
            onChange={setDueTime}
            disabled={!hasDueDate}
            {...attributes}
          />
        )}
      </ValidatedField>
    </div>
  );
}

function RecurringFields({ errors }: { errors: TaskFormErrors }) {
  const [firstDueDate, setFirstDueDate] = useState(currentLocalDate());
  const [dueTime, setDueTime] = useState("");
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <ValidatedField name="firstDueDate" label="First due date" error={errors.firstDueDate}>
          {(attributes) => (
            <DateInputDayFirst
              id="firstDueDate"
              name="firstDueDate"
              monthLabel="First due date month"
              yearLabel="First due date year"
              value={firstDueDate}
              onChange={setFirstDueDate}
              required
              {...attributes}
            />
          )}
        </ValidatedField>
        <ValidatedField name="dueTime" label="Due time" error={errors.dueTime}>
          {(attributes) => (
            <TimeInput24
              id="dueTime"
              name="dueTime"
              minuteLabel="Due time minute"
              value={dueTime}
              onChange={setDueTime}
              {...attributes}
            />
          )}
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
