# Implementation Plan: Keep Due Time for Completion-Based Recurrence

## Outcome

Implement the approved behavior in `docs/specs/keep-due-time.md` without
changing scheduled-cycle or strict elapsed recurrence. Timed day/week tasks
using From completion date default to **Keep due time** and persist that choice
with the exact-title `vbu:fixed-due-time` label on the live series.

This plan does not implement the feature. It defines the implementation order,
safety invariants, verification, and review checkpoints.

## Commands

Run all project commands inside the existing Dev Container:

```text
task gen
task gen:check
task fix
task validate
task test
task e2e
```

Focused checks:

```text
go test ./internal/service ./internal/vikunja ./internal/graphql/resolver
pnpm --dir frontend exec vitest run <test-file>
pnpm --dir frontend exec playwright test <arguments>
```

## Architecture decisions

- Keep Vikunja recurrence mode `2` authoritative for From completion date.
  Native completion still runs exactly once; the application adjusts only the
  renewed due timestamp when the fixed-time marker is enabled.
- Capture one server action instant immediately before the checked native
  completion. Its local calendar date is the completion anchor used for the
  precomputed target. This makes DST validation possible before any upstream
  write and avoids deriving the target from a response received afterward.
- Preserve the completed occurrence's local due clock, including seconds. Add
  the recurrence interval as local calendar days (`DAY = interval`,
  `WEEK = interval * 7`), then resolve that wall time with the existing strict
  timezone resolver. Reject gaps, folds, overflow, and unsupported recurrence
  state before mutation.
- Keep strict elapsed recurrence unchanged when the marker is absent. Vikunja's
  renewed timestamp, based on its authoritative `done_at`, remains the result.
- Treat `vbu:fixed-due-time` as valid only on an active, timed, mode-2 recurring
  task whose interval is a positive whole number of 24-hour days. A marked
  date-only, scheduled, monthly, completed, history, job, or malformed task is
  invalid and cannot Complete or Skip.
- Add `keepDueTime: Boolean!` to `RecurrenceRule` and
  `CreateRecurringTaskInput`, defaulting the input to `true`. The value is an
  application setting derived from the marker; ordinary UI code never parses
  the marker to determine behavior.
- Add a focused active-series mutation to enable or disable the setting. It
  changes future renewals only. Enabling resolves and attaches the marker;
  disabling removes every exact-title marker attached to the task. Both paths
  refetch and confirm authoritative state.
- Add a Vikunja task-label detach adapter. This adds the `delete` action to the
  documented and E2E-generated `tasks_labels` token permission group.
- Bind Complete and Skip for recurring tasks to the loaded occurrence's
  expected due timestamp. A stale action or replay is rejected before native
  completion. This is required to uphold the existing no-double-renewal repair
  rule.
- Extend sealed recurring repair data with the renewed occurrence identity,
  native renewed due timestamp, and optional normalized target. Repair accepts
  exactly two due states: native normalization pending, or target already
  normalized. Any other state is a conflict.
- Repair performs missing due normalization before History reconciliation. It
  uses a checked patch when pending, refetches, verifies, and then creates or
  repairs the snapshot. Retrying after either step is idempotent and never
  calls native completion.
- Exclude `vbu:fixed-due-time` from both initial and repaired History snapshot
  label copies. Keep it in the live renewed series and hide it from visible
  label badges.
- Apply one shared calculation and workflow to Complete and Skip. Outcome
  affects only the History snapshot marker, not renewal timing.
- Add no dependency, database, background worker, or direct browser-to-Vikunja
  request.

## State transition

```text
active occurrence + expected due
  -> validate marker compatibility and precompute target
    -> checked native completion once
      -> verify native renewed occurrence
        -> checked due normalization when enabled
          -> reconcile History snapshot without fixed-time marker
            -> confirmed

After native renewal, any failure
  -> sealed repair capability
    -> verify renewed occurrence and allowed due state
      -> finish normalization if needed
        -> reconcile History snapshot
          -> confirmed (never renew again)
```

## Dependency graph

```text
Marker semantics ───────┐
                       ├─> Safe recurring workflow ─> GraphQL contract
Calendar-time resolver ┘              │                     │
                                      └─> Repair model       ├─> Create UI
Label detach adapter ─> Setting service ─────────────────────┘
                                                            └─> Detail UI

All slices -> reserved-label filtering -> real Vikunja E2E -> full gates
```

## Implementation phases

### Phase 1: Domain rules and calculation

1. Register `vbu:fixed-due-time` as a reserved marker and extend task
   classification with its derived state and compatibility rules. Disabling an
   incompatible existing marker must remain possible through the setting
   service even though task actions are blocked.
2. Add a pure fixed-due-time calculator. Cover early and late completion,
   day/week intervals, local calendar addition across offset changes, seconds
   preservation, year overflow, nil timezone, and DST gap/fold rejection.
3. Add recurring occurrence preconditions for Complete and Skip. Compare the
   expected due instant to the authoritative pre-write task and reject missing,
   stale, or replayed recurring actions before mutation.

Checkpoint: focused service tests pass; review confirms all invalid targets and
stale actions make zero upstream write calls.

### Phase 2: Mutation safety and repair

4. Precompute the target from the captured action instant, perform one checked
   native completion, verify Vikunja's native renewal, then normalize the due
   timestamp with a checked patch. Scheduled, strict elapsed, and date-only
   paths retain their current behavior.
5. Extend the sealed repair grant and reconciliation workflow to finish an
   interrupted normalization before History archival. Prove retries from every
   boundary are idempotent: after native renewal, after normalized patch, after
   snapshot creation, after label attachment, and after snapshot completion.
6. Exclude the fixed-time marker from all initial and repair snapshot label
   copy paths. Verify Complete and Skip produce the same renewed due timestamp
   while preserving their distinct History outcomes.

Checkpoint: focused capability and recurring-completion tests pass; review
confirms no repair path invokes native completion and no History task receives
the marker.

### Phase 3: Persistence and GraphQL API

7. Add the checked Vikunja label-detach adapter and an idempotent active-series
   setting service. Cover duplicate exact-title markers, already-enabled and
   already-disabled requests, partial detach failure, incompatible enablement,
   concurrent state changes, and confirmation by refetch.
8. Extend the GraphQL contract with `keepDueTime`, recurring occurrence
   preconditions, and the focused setting mutation. Keep resolvers thin, map
   validation/conflict/upstream errors safely, and regenerate gqlgen plus
   frontend operation types.
9. Make recurring creation default the setting to enabled only when eligible.
   Resolve the marker before task creation, reuse the existing marker repair
   capability if attachment fails, and reject explicit enablement for
   date-only, scheduled-cycle, or monthly input before task creation.

Checkpoint: `task gen`, focused resolver tests, and `task gen:check` pass.
Schema review confirms the label title is not part of the public setting API.

### Phase 4: User interface

10. Add **Keep due time** to recurring creation. Show it only when Due time is
    present, renewal is From completion date, and unit is Day or Week. Default
    it on whenever it becomes eligible, remove it from submitted input when it
    is inapplicable, and explain the calendar-time versus exact-elapsed effect.
11. Show the active-series setting on recurring task details with clear
    future-only wording. Disable controls while saving, announce success and
    errors accessibly, refetch detail/list data after confirmation, and allow
    an invalid marked series to turn the setting off.
12. Hide the marker in all ordinary label displays and add focused tests for
    create-form transitions, task-detail policy, mutation feedback, keyboard
    operation, and narrow layouts.

Checkpoint: focused Vitest tests, frontend typecheck, and browser inspection
pass at phone and desktop widths.

### Phase 5: Real-state verification and documentation

13. Extend the isolated Vikunja 2.5.0 fixtures and token permissions. Add
    Playwright assertions that compare UI outcomes with direct upstream state
    for enabled, disabled, scheduled, Complete, Skip, setting changes, marker
    persistence, and History exclusion.
14. Add boundary E2E coverage for stale occurrence rejection and interrupted
    post-renewal repair. Assert the live task keeps its ID, native completion
    happens once, repair does not advance it again, and only one matching
    History snapshot exists.
15. Update README/spec implementation status and user guidance, regenerate the
    embedded frontend, then run all final gates after the last edit.

Checkpoint: `task gen:check`, `task validate`, `task test`, and `task e2e` pass
against a fresh isolated Vikunja instance.

## Test matrix

| Mode | Marker | Due kind | Action | Expected renewal |
| --- | --- | --- | --- | --- |
| From completion | On | Timed day/week | Complete | Completion local date + calendar interval, original clock |
| From completion | On | Timed day/week | Skip | Same calculation as Complete |
| From completion | Off | Timed day/week | Either | Native exact elapsed duration |
| Scheduled cycle | Off | Timed day/week/month | Either | Existing scheduled advancement |
| From completion | On | Date-only | Either | Reject before write as incompatible |
| Scheduled/monthly | On | Any | Either | Reject before write as incompatible |
| From completion | On | DST gap/fold target | Either | Reject before write |
| Any recurring mode | Any | Stale expected due | Either | Conflict before write |

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Vikunja renews but normalization response fails | High | Sealed repair grant recognizes native and normalized due states; repair never renews |
| User retries an occurrence after a lost response | High | Require and check the occurrence's expected due instant before native completion |
| Request crosses local midnight | Medium | Use the single server-captured pre-write action instant as the documented completion anchor |
| DST target is missing or ambiguous | High | Resolve the target before write with the strict wall-time resolver; reject both cases |
| Marker is attached to an incompatible task | High | Classify as invalid; block Complete/Skip; permit only corrective disablement |
| Marker leaks into History | Medium | Central exclusion predicate used by create and repair paths, with direct upstream assertions |
| Marker detach partially succeeds across duplicates | Medium | Remove exact-title IDs idempotently, refetch, and return retryable failure until none remain |
| Token cannot remove a marker | Medium | Add `tasks_labels:delete` to README and E2E token permissions |
| Frontend submits a stale hidden checkbox value | Low | Derive applicability from controlled due-time/mode/unit state and validate again server-side |
| Generated code or embedded assets drift | Medium | Run generation before `gen:check`; finish with all repository gates |

## Review checkpoints

- Domain review: marker compatibility and calendar-time calculation.
- Safety review: occurrence identity, checked patching, repair states, and no
  second native renewal.
- API review: additive GraphQL contract, safe errors, and hidden persistence
  detail.
- UX/accessibility review: conditional setting, future-only language, feedback,
  and responsive layout.
- Release review: real Vikunja state, token scopes, generated code, and docs.

## Boundaries

### Always

- Preserve the `React -> Go GraphQL -> Vikunja REST` boundary.
- Use the session user's configured timezone.
- Apply identical timing rules to Complete and Skip.
- Use exact-title marker matching and authoritative refetch verification.
- Write focused tests before each behavior change.
- Keep generated files reproducible and update documentation with behavior.

### Ask first

- Change the default, marker title, supported units, timezone source, or the
  approved calendar-time semantics.
- Add persistence, a dependency, a background process, or a different Vikunja
  recurrence representation.
- Make an incompatible GraphQL change.

### Never

- Retry native completion during repair.
- Silently fall back to strict elapsed behavior for a marked task.
- Copy `vbu:fixed-due-time` to History.
- Infer enabled state from frontend-only state or expose the API token.
- Claim success before renewed due state and History outcome are confirmed.

## Definition of done

- Every acceptance criterion in `docs/specs/keep-due-time.md` is covered by a
  focused automated test.
- Unit, resolver, frontend, and real Vikunja E2E tests prove enabled, disabled,
  scheduled, Complete, Skip, DST, stale-action, and repair behavior.
- The public schema, generated code, README, token scopes, embedded assets, and
  implementation status agree.
- `task gen:check`, `task validate`, `task test`, and `task e2e` pass after the
  final edit.
- A human reviews each checkpoint and confirms no unrelated behavior changed.

## Open questions

None. The server-captured pre-write action instant is the technical definition
of the completion anchor required to make the approved preflight guarantee
implementable.
