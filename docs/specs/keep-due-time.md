# Spec: Keep due time for completion-based recurrence

Status: Implemented.

## Objective

Let a recurring task renew from the date on which it was completed while keeping
its configured local due time. This supports routines that may be completed at
any time during the day but should retain a predictable deadline, such as a task
done every two days and due by 20:00.

The feature must preserve strict elapsed recurrence as an explicit alternative
and must not change scheduled-cycle behavior.

## User-facing behavior

Recurring tasks retain the existing renewal choices:

1. **From completion date** anchors the next occurrence to the completion date.
2. **Scheduled cycle** anchors the next occurrence to the existing schedule.

Timed tasks using **From completion date** also expose **Keep due time**:

- It is enabled by default.
- When enabled, the next local date is the completion date plus the configured
  calendar interval. The next due time is copied from the occurrence that was
  completed.
- When disabled, Vikunja's strict elapsed behavior remains authoritative. A
  two-day interval means exactly 48 hours after completion.
- The setting applies equally to **Complete** and **Skip**.
- The setting may be changed for an active recurring series. Changing it affects
  future renewals only; it does not rewrite the current due date or History.

Date-only tasks do not show **Keep due time**. Monthly recurrence remains a
scheduled cycle because Vikunja 2.5.0 does not support completion-based monthly
recurrence in this application.

## Exact examples

Assume a two-day interval, a configured due time of 20:00, and the application
timezone used by the signed-in session.

| Renewal configuration | Completion | Next due |
| --- | --- | --- |
| From completion date; Keep due time on | Sunday 10:00 | Tuesday 20:00 |
| From completion date; Keep due time on | Sunday 21:00 | Tuesday 20:00 |
| From completion date; Keep due time off | Sunday 10:00 | Tuesday 10:00 |
| From completion date; Keep due time off | Sunday 21:00 | Tuesday 21:00 |
| Scheduled cycle; current due Monday 20:00 | Sunday 10:00 | Wednesday 20:00 |
| Scheduled cycle; current due Monday 20:00 | Tuesday 10:00 | Wednesday 20:00 |

For completion-based recurrence with **Keep due time**, "two days" means two
local calendar dates, not 48 elapsed hours. The elapsed duration may therefore
be shorter or longer than 48 hours.

Scheduled cycle continues advancing from the previous due date. When multiple
scheduled occurrences are already past, it advances to the first future
scheduled occurrence.

## Timezone and daylight-saving behavior

- The preserved clock time is interpreted in the application's configured
  timezone at completion.
- **Keep due time** preserves the local clock value across offset changes. Its
  elapsed duration may be 47 or 49 hours across a daylight-saving transition.
- Strict elapsed mode preserves the exact duration and may display a different
  local clock time after an offset change.
- Before completing or skipping, the backend must calculate the target local
  timestamp. If that clock time is missing or ambiguous because of a timezone
  transition, it must reject the action without writing to Vikunja. The user can
  choose a valid due time or disable **Keep due time**.

## Persistence and marker rules

The application remains stateless. The exact-title Vikunja label
`vbu:fixed-due-time` stores the enabled state on the live recurring task.

- The UI presents a setting, not a label.
- The marker is hidden anywhere ordinary task labels are displayed.
- The marker stays on the renewed live series.
- The marker is never copied to a completed or skipped History snapshot.
- The marker is valid only on a timed, active, From-completion recurring task
  using a supported day or week interval.
- An incompatible marked task is an invalid recurrence configuration. Complete
  and Skip must not mutate it until the setting or recurrence rule is corrected.
- Removing the marker restores strict elapsed behavior for future renewals.

## Completion and Skip workflow

1. Read the live task, recurrence fields, labels, dates, and checked upstream
   state.
2. If **Keep due time** applies, calculate and validate the target timestamp
   before any write.
3. Perform the existing checked native Vikunja completion exactly once.
4. Refetch and verify same-task renewal using the native recurrence mode.
5. When **Keep due time** applies, patch the renewed task to the precomputed
   local date and preserved clock time using checked state, then refetch and
   verify it.
6. Create or reconcile the existing non-recurring History snapshot from the
   completed occurrence, excluding `vbu:fixed-due-time`.
7. Report success only after the renewed live task and History outcome are
   confirmed. A partial failure must use the existing repair model and must
   never repeat native completion.

## Tech stack and project structure

- Go services under `internal/service` own recurrence calculation and workflow
  safety.
- `internal/vikunja` owns upstream fields and checked patches.
- GraphQL schema and resolvers expose the setting without exposing the marker.
- React task creation and active-series settings present the user-facing option.
- Unit tests remain beside their source; real Vikunja coverage remains in
  `tests/e2e`.

## Code style

Use explicit domain names and calculate the target before mutation:

```go
targetDueAt, err := resolveCompletionDateDueTime(completedAt, currentDueAt, interval, location)
if err != nil {
	return RecurringCompletion{}, err
}
```

Do not encode behavior in generic maps, duplicate recurrence calculations in
resolvers, or expose reserved labels through the GraphQL setting.

## Commands

Run inside the existing Dev Container:

```sh
task gen
task validate
task test
task e2e
```

## Testing strategy

- Unit-test early and late completion, day and week intervals, strict elapsed
  fallback, scheduled cycles, Complete, Skip, marker compatibility, and History
  label exclusion.
- Unit-test timezone offset changes and rejection of missing or ambiguous local
  times before mutation.
- Integration-test checked patches, partial failures, repair without a second
  renewal, and marker creation/attachment failures.
- E2E-test all three visible behaviors against the pinned Vikunja 2.5.0
  instance and assert the renewed live task keeps its ID.

## Boundaries

- Always: use native Vikunja completion once, verify every post-renewal patch,
  keep History snapshots non-recurring, and apply the same rule to Complete and
  Skip.
- Ask first: change the default, marker title, supported units, timezone source,
  or GraphQL behavior after this specification is approved.
- Never: store recurrence state in a database, copy the marker to History,
  silently fall back when a marked task is incompatible, or retry native
  completion after an ambiguous result.

## Success criteria

- A new timed From-completion task defaults **Keep due time** to enabled.
- The examples in this specification produce the stated next due timestamps.
- Disabling the setting preserves exact elapsed recurrence.
- Scheduled-cycle results remain unchanged.
- Complete and Skip produce identical next-occurrence calculations.
- The hidden marker persists only on the live series and never appears in the
  visible label list or History snapshots.
- Invalid timezone targets and incompatible marker states cause no upstream
  mutation.
- Validation, unit tests, and real-Vikunja E2E tests pass.

## Open questions

None for product behavior. The technical plan may refine interface names but
must not change these semantics without updating this specification first.
