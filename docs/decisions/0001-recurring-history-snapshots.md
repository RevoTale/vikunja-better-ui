# ADR-001: Store recurring history as Vikunja task snapshots

## Status

Accepted.

## Date

2026-08-12.

## Context

The product needs predictable native recurrence and durable completion history
without an application database. A signed Vikunja 2.5.0 binary was tested with
isolated SQLite data. Completing the same recurring task twice showed that
Vikunja:

- keeps the same task ID;
- immediately returns the task to `done=false`;
- advances its due date according to the recurrence mode;
- overwrites the task's single `done_at` value; and
- exposes no occurrence-history or audit resource through API v2.

Therefore native renewal alone cannot support the History screen or future
completion statistics.

## Decision

Keep native Vikunja recurrence as the only mechanism that advances the live
schedule. After a native renewal is verified, create one incomplete snapshot in
the same Vikunja project, attach its labels, then complete it with an atomic
JSON Patch representing the occurrence that just finished. This two-step write
is required because Vikunja 2.5.0 leaves `done_at` empty when a task is created
with `done=true`.

The snapshot copies the occurrence's user-visible fields, has
`repeat_after=0` and `repeat_mode=0`, and receives the exact label
`vbu:recurrence-history`. A deterministic, non-secret completion key stored in
a preserved HTML comment supports reconciliation after an unknown response.
Repair must prove that no matching snapshot exists before creating one.

The live task remains the sole recurring task. The snapshot never appears in an
active view and never renews. Both records remain ordinary Vikunja data; the app
adds no database.

## Alternatives considered

### Use native renewal without snapshots

Rejected because only the latest `done_at` survives. Earlier completions and
future statistics would be lost.

### Manage recurrence in this application

Rejected because creating the next task through a separate POST introduces
missing or duplicate schedules after ambiguous network outcomes. Native renewal
is safer for the primary workflow.

### Store completion events locally

Rejected because the accepted architecture requires Vikunja to remain the only
durable application data store.

## Consequences

- Completed recurring occurrences are visible in Vikunja as completed tasks.
- The `vbu:recurrence-history` label clearly identifies generated snapshots.
- Snapshot creation is an additional multi-write workflow and requires
  idempotent repair.
- A snapshot cannot contain recurrence fields. Such a task is invalid and must
  not be completed by this app.
- Deleting or editing snapshots in Vikunja intentionally changes available
  history because Vikunja remains authoritative.
