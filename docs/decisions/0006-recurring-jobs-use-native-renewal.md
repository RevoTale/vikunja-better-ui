# ADR-006: Normalize recurring Job schedules after native renewal

## Status

Accepted.

## Date

2026-08-27.

## Context

Jobs add a start, duration, and completion window to a task. Recurring Jobs must
anchor scheduled recurrence to `startAt`, while From-completion recurrence must
either use an exact interval from completion or retain the selected local start
time. Vikunja renews a recurring task in place, but its From-current mode anchors
the renewed `dueAt` to completion and reconstructs other dates as offsets from
that due date. Overdue scheduled renewal can also advance date fields
independently. Neither behavior guarantees a coherent Job interval.

The application already relies on native same-ID renewal to avoid duplicate or
missing live schedules and already normalizes fixed-time due dates after that
renewal.

## Decision

Keep Vikunja native renewal as the only operation that advances the live task.
After renewal is confirmed, derive the intended recurring Job interval from the
pre-renewal occurrence and the confirmed completion time, then conditionally
patch `startAt`, `endAt`, and `dueAt` together.

Carry both native and target schedule fields in the sealed recurring-repair
capability. A repair validates that the live task is still the same renewed
occurrence before completing normalization or creating the History snapshot.
Repair never marks the live task done again.

Store `job` and fixed-time behavior as exact Vikunja labels. Completed snapshots
retain `job` but omit recurrence and fixed-time markers.

## Alternatives considered

### Let Vikunja dates stand

Rejected because From-current renewal anchors the wrong Job boundary and can
shift `startAt` earlier than the agreed schedule.

### Create the next Job in Better UI

Rejected because an ambiguous create response can produce duplicate or missing
live occurrences and would replace the proven same-ID renewal model.

### Store a separate Job series locally

Rejected because the application is stateless and Vikunja is the only durable
application data store.

## Consequences

- Recurring Jobs preserve one live Vikunja task ID.
- Completion may require one additional conditional task patch.
- Partial failure is explicit and repairable without renewing twice.
- Creation and repair must support more than one exact metadata marker.
- Weekly projections must project the complete Job interval, not only `dueAt`.
