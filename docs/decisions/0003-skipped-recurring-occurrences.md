# ADR-003: Record skipped recurring occurrences as labeled snapshots

## Status

Accepted.

## Date

2026-08-14.

## Context

The user needs to dismiss one recurring occurrence without claiming the work
was performed and without stopping the future series. Vikunja 2.5.0 has no
skipped or cancelled task status. Its native recurring completion renews the
same live task and overwrites that task's single completion timestamp.

ADR-001 already retains each recurring occurrence as a completed,
non-recurring Vikunja snapshot marked `vbu:recurrence-history`. The application
must remain stateless, and task comments may be disabled and are not suitable
for filtering or classification.

## Decision

Skip uses the same checked native completion and verified renewal workflow as a
normal recurring completion. The resulting history snapshot also receives the
exact Vikunja label `vbu:skipped`. The renewed live task never receives that
label.

Vikunja renews a recurring task in place, so its task ID identifies the series
but not one occurrence. A Skip request therefore carries `taskId` and the
loaded task's `expectedDueAt`. Before native renewal, the backend refetches the
task and requires its current due date to represent the same absolute instant.
A missing or different due date returns `CONFLICT` without mutation.

This is an occurrence precondition, not stored idempotency state. If renewal
succeeds but the response is lost, replaying the original request encounters
the advanced due date and cannot skip the next occurrence. The UI refetches the
task and reports that the occurrence changed. No automatic Skip retry is
allowed.

The protection deliberately stops at renewal safety. If execution stops after
renewal but before the skipped snapshot is completed, History may have no entry
for that occurrence, or Vikunja may retain an incomplete technical snapshot. A
stale retry does not recreate or finalize it because the client did not receive
a repair capability and the app stores no pending operation. The UI must
describe the result as ambiguous and must not claim that archival succeeded.

The current Better Vikunja system reserves the `vbu:` exact-title label
namespace for its Vikunja-backed metadata. This is an application convention,
not an official Vikunja namespace. `vbu:skipped` is valid only together with
`vbu:recurrence-history` on a completed, non-recurring snapshot.

The label is the durable source of truth. GraphQL derives a `SKIPPED` completion
outcome from it, History displays `Skipped`, and repair capabilities retain the
intended outcome so they can attach missing markers without renewing twice.
No comment is created.

## Alternatives considered

### Add a comment to the renewed live task

Rejected because the same task represents every future occurrence. Its
comments would accumulate series-wide history and could be mistaken for the
state of the current occurrence.

### Add a comment to the history snapshot

Rejected as the source of truth because Vikunja comments can be disabled and
comment text is not a stable, filterable classification contract. It would also
add another repairable write without adding information beyond the label.

### Advance dates without native completion

Rejected because it bypasses Vikunja's recurrence behavior, produces no real
completion timestamp, and creates another schedule implementation that could
diverge or duplicate occurrences.

### Delete the occurrence

Rejected because Vikunja stores the recurring series as one live task. Deleting
it stops the series rather than skipping one occurrence and leaves no truthful
history record.

### Use only the Vikunja task ID

Rejected because native recurrence retains the same ID. A retry after an
ambiguous successful response could otherwise advance the next occurrence.

### Store an idempotency request ID

Rejected because it would require application persistence or another service.
The authoritative due date already supplies the required occurrence
precondition while keeping the app stateless.

### Create a pending history record before renewal

Deferred because it adds another durable intermediate state, classification,
cleanup path, and reconciliation workflow. The MVP accepts a rare missing
History entry instead of increasing complexity, while still preventing the
more harmful second renewal.

## Consequences

- Skipped and completed occurrences remain distinct Vikunja-backed history.
- Existing recurrence verification and snapshot reconciliation remain the
  safety boundary for both actions.
- Skip follows Vikunja's native overdue advancement, even when a fixed interval
  advances past more than one missed schedule.
- A stale or replayed Skip fails with `CONFLICT` before any write. Users must
  refresh to act on the newly loaded occurrence.
- A partial failure after renewal can leave no skipped snapshot or one
  incomplete technical snapshot. This is an accepted MVP limitation, not a
  state the app automatically repairs.
- Valid recurring Skip targets must have a due date. Other completion and
  deletion contracts do not gain this precondition.
- Removing or renaming `vbu:skipped` in Vikunja intentionally changes the next
  application read because no parallel application state exists.
- Marker creation and attachment can partially fail, so recurring repair must
  carry and verify the intended outcome.
