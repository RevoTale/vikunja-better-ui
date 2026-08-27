# ADR-007: Keep task creation autofill local and isolated

## Status

Accepted.

## Date

2026-08-27.

## Context

Creating several typical tasks should not require repeating the same title,
project, priority, and schedule values. The helper must remain optional and must
never erase a value entered while projects or other form dependencies are still
loading.

Vikunja does not represent Better UI's complete creation-form state. Searching
recent Vikunja tasks would add latency, API calls, ambiguity between task types,
and coupling to historical data. The application also intentionally has no
database for preferences.

Inline storage access in individual form components would scatter precedence
and dirty-field behavior across multiple Task and Job layouts, making delayed
value collisions difficult to test and reason about.

## Decision

Store the last successful creation values in versioned, mode-specific
`localStorage` namespaces. Treat storage as unavailable unless access, decoding,
and writes succeed. Storage failure never changes task creation behavior.

Put all storage access, decoding, precedence, field ownership, and scope
transitions in a dedicated typed module under
`frontend/src/features/tasks/autofill/`. Form components use that module's API
and never access `localStorage` directly.

Apply candidates once per form scope. Explicit route context and user-owned
fields take precedence. Async project loading and cross-tab storage events do
not trigger a second autofill pass.

Persist an immutable submission snapshot only after Vikunja has created the
task. A repair-required response counts as created, while repair retries do not
write again.

## Alternatives considered

### Search recent tasks in Vikunja

Rejected because it adds an upstream dependency to form initialization, cannot
reconstruct every creation choice reliably, and risks stale or surprising
matches.

### Store preferences in the Go service

Rejected because cross-device synchronization is not required and persistence
would conflict with the stateless application boundary.

### Access localStorage directly from each form component

Rejected because it duplicates decoding and precedence rules and makes value
collision bugs likely during asynchronous rendering and form-type changes.

### Restore abandoned drafts

Rejected because the requested helper remembers successful examples, not
unfinished user input. Draft recovery has different privacy and lifecycle
requirements.

## Consequences

- Autofill is local to one browser origin and may disappear when browser data is
  cleared.
- The form remains fully usable when browser persistence is disabled.
- Task and Job forms share one collision contract without sharing incompatible
  stored values.
- Pure state-transition tests can cover equality collisions and delayed data
  without a browser.
- The feature adds no network calls, backend state, GraphQL fields, or runtime
  dependency.

