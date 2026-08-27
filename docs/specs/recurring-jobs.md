# Recurring Jobs

## Status

Accepted on 2026-08-27.

## Outcome

A Job is an optional scheduling mode for both one-time and recurring tasks. It
adds a start, duration, and completion window without replacing the task's
recurrence identity.

## User experience

- Task creation offers `One-time` and `Recurring` as the primary task types.
- A `Job` checkbox is available for both types.
- A one-time Job may keep its generated title when the title is empty.
- A recurring Job requires a stable title.
- Job fields are `startAt`, duration, and completion window.
- A live recurring Job displays separate `Job` and `Recurring` badges.
- Completion and Skip have no confirmation or Undo for every recurring task,
  including recurring Jobs.

The legacy `type=job` creation URL remains accepted and opens a one-time task
with Job enabled.

## Schedule model

For every Job occurrence:

```text
endAt = startAt + duration
dueAt = endAt + completionWindow
```

The next occurrence is anchored by `startAt`:

- Scheduled cycle advances from the previous scheduled `startAt`. If an
  occurrence is overdue, advance whole intervals until the next `startAt` is
  after the completion instant.
- From completion with `Keep start time of day` disabled uses
  `startAt = doneAt + exact elapsed interval`.
- From completion with `Keep start time of day` enabled uses the completion date in
  the user's Vikunja timezone, advances by the configured number of calendar
  days or weeks, and restores the previous occurrence's local start time. This
  preserves the selected clock time across DST transitions.
- `Keep start time of day` is available only for timed day/week recurrence in
  From-completion mode, matching the existing fixed-time recurrence boundary.
- Monthly recurring Jobs use Vikunja's supported scheduled monthly mode.

## Persistence and completion

- Vikunja remains the only durable data store.
- The live series uses Vikunja's native same-task-ID renewal.
- Better UI verifies renewal and then normalizes the renewed `startAt`,
  `endAt`, and `dueAt` to the Job schedule model.
- A partial normalization returns a repair-required result. Repair may update
  only the already-renewed live task and its history snapshot; it must never
  renew the task again.
- Each completed or skipped occurrence creates a non-recurring History snapshot
  because Vikunja exposes only the latest `done_at` for the renewed task.
- The snapshot keeps the exact `job` label and receives
  `vbu:recurrence-history`; skipped occurrences also receive `vbu:skipped`.
- The snapshot does not keep recurrence or fixed-time marker fields.

## Contracts

- A live recurring Job has GraphQL `kind: JOB` and a non-null
  `recurrenceRule`. No `RECURRING_JOB` enum value is added.
- A completed recurring Job snapshot has `kind: JOB`, no recurrence rule, and
  a completion outcome.
- Existing one-time Job requests and `createJob` callers remain supported.
- The Jobs list and `/integrations/v1/jobs` include active recurring Jobs.
- Completed recurring Job snapshots remain available through completed Jobs
  queries and integrations.
- Weekly projections include projected `startAt`, `endAt`, and `dueAt`; they
  remain computed, lower-emphasis entries and are not written to Vikunja.
- From-completion future occurrences cannot be projected before the current
  occurrence is completed.

## Test matrix

- Create one-time Job with generated title.
- Create recurring Job with required title and separate Job/Recurring badges.
- Reject recurring Job without a title.
- Scheduled day/week/month renewal anchors to the prior `startAt` and preserves
  duration and completion window, including overdue completion.
- From-completion day/week renewal without fixed time uses an exact elapsed
  interval from `doneAt`.
- From-completion day/week renewal with fixed time preserves local `startAt`
  across normal dates and DST transitions.
- Reject fixed time for missing time, scheduled mode, or monthly recurrence.
- Completed and skipped snapshots retain Job classification and integration
  visibility without recurrence fields.
- Partial schedule normalization is repairable without a second renewal.
- Weekly scheduled projections expose coherent projected Job intervals.

## Out of scope

- A separate recurrence engine or application database.
- A new GraphQL task kind.
- Per-occurrence editing or exceptions.
- Projecting unknown future dates for From-completion recurrence.
