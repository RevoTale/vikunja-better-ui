# ADR-002: Repair recurring history without renewing twice

## Status

Accepted.

## Date

2026-08-12.

## Context

Completing a recurring task first asks Vikunja to renew the live task and then
creates the completed history snapshot described in ADR-001. Vikunja can renew
successfully while snapshot creation fails. Repeating the completion mutation
would renew the live task a second time and skip an occurrence.

## Decision

When renewal is confirmed but history is incomplete, return a repair-required
completion result with no completed task and a short-lived, signed,
session-bound repair capability. The UI explains that renewal already finished
and offers a repair action. That action reconciles or creates only the missing
snapshot; it never completes the live task again.

The capability contains only the minimum repair identity, is not stored by the
application, expires, and cannot be used from another session. The GraphQL
`completedTask` field is nullable because a repair-required outcome has no safe
completed snapshot to return yet.

## Consequences

- Retrying repair cannot advance recurrence a second time.
- The semantic outcome remains explicit to both the UI and API clients.
- A page reload can discard the in-memory repair action. The next completion
  still reconciles by the deterministic history key before creating anything.
- Repair capabilities must never be logged or exposed in URLs.
