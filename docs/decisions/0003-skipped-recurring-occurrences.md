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

## Consequences

- Skipped and completed occurrences remain distinct Vikunja-backed history.
- Existing recurrence verification and snapshot reconciliation remain the
  safety boundary for both actions.
- Skip follows Vikunja's native overdue advancement, even when a fixed interval
  advances past more than one missed schedule.
- Removing or renaming `vbu:skipped` in Vikunja intentionally changes the next
  application read because no parallel application state exists.
- Marker creation and attachment can partially fail, so recurring repair must
  carry and verify the intended outcome.
