# Implementation Plan: Skip Recurrence and Delete Active Task

## Overview

Add two actions to the separate task page. Skip advances one valid recurring
task through Vikunja's native renewal and records a completed history snapshot
marked `vbu:skipped`. Delete removes only an active upstream task after a
server-side guard and a routed confirmation. History remains read-only. The app
continues to store no application data and adds no dependency.

## Commands

Run every project command inside the existing Dev Container:

```text
task gen
task gen:check
task fix
task validate
task test
task e2e
```

Focused Go packages may be tested inside the container with:

```text
go test ./internal/service ./internal/vikunja ./internal/graphql/resolver
```

Focused frontend tests may be run inside the container with:

```text
pnpm --dir frontend exec vitest run <test-file>
pnpm --dir frontend exec playwright test <arguments>
```

## Architecture decisions

- Keep `vbu:` as the exact-title Vikunja-label namespace reserved by the
  current Better Vikunja system. Add `vbu:skipped`; do not add comments or
  application persistence.
- Model skipped state as a derived `CompletionOutcome`, not a new task kind.
  The history snapshot remains `RECURRING`; its outcome is `SKIPPED`.
- Reuse the checked native recurring completion and snapshot repair workflow.
  Parameterize the shared workflow by outcome instead of copying it.
- Carry the intended outcome in the sealed recurring repair capability. A skip
  is confirmed only after the snapshot has both history and skipped markers.
- Add a dedicated GraphQL `skipRecurringTask` action rather than overloading
  `completeTask` with a Boolean flag.
- Add a dedicated GraphQL `deleteTask` action returning the deleted ID. Read and
  reject completed or history-marker tasks before calling Vikunja DELETE.
- Treat the active-only delete guard as a documented best effort across clients:
  Vikunja 2.5.0 exposes no conditional DELETE, so an external client can race
  the read-before-delete check.
- Keep Skip and Delete off list rows and History. Place them beside `Extended`
  on active task details. Delete alone uses destructive styling and opens a
  semantic confirmation route.
- Preserve Apollo's `cache-and-network` query policy. Confirmed Skip refetches
  affected lists/detail data; confirmed Delete evicts the ID and returns to the
  validated originating route.

## Dependency graph

```text
Reserved marker and completion outcome
  -> outcome-aware recurring snapshot and repair
    -> GraphQL skip contract
      -> task-detail Skip action

Vikunja DELETE adapter
  -> active-only deletion service
    -> GraphQL delete contract
      -> routed confirmation UI

Both vertical slices
  -> History outcome presentation and mutation guards
    -> real Vikunja fixtures and Playwright assertions
      -> generated embedded assets and full validation
```

## Implementation phases

### Phase 1: Domain safety

1. Add the skipped marker and derived completion outcome with table-driven
   classification tests, including every invalid marker combination.
2. Extend recurring completion and sealed repair grants with an explicit
   outcome. Prove normal completion does not receive the skipped marker, Skip
   receives both required markers, conflicting reconciliation is rejected, and
   partial repair never renews twice.
3. Add the Vikunja v2 DELETE adapter and an active-only service workflow. Prove
   completed, recurrence-history, and skipped-marker tasks are rejected before
   DELETE while active one-time, job, recurring, and invalid active tasks can be
   removed.

Checkpoint: focused service and Vikunja tests pass with no GraphQL or UI change.

### Phase 2: GraphQL vertical slices

4. Add `CompletionOutcome`, skipped marker/repair values,
   `skipRecurringTask`, and `deleteTask` to the schema. Keep resolvers thin,
   map stable errors including `TASK_NOT_ACTIVE`, regenerate gqlgen and frontend
   operation types, and cover resolver authorization, CSRF, outcome, repair,
   and deletion guards.

Checkpoint: `task gen`, focused resolver tests, and `task gen:check` pass.

### Phase 3: Task-page experience

5. Add the one-click Skip action beside `Extended` for active valid recurring
   tasks. Use shared pending/error feedback, block duplicate actions, and omit
   the control from completed, invalid, and non-recurring details.
6. Add the destructive Delete action beside `Extended` for active tasks and the
   `/tasks/:id/delete` confirmation page. Name the task, support Cancel/Back,
   preserve validated `returnTo`, prevent double submission, evict confirmed
   deletions from Apollo, and omit the action for History/completed tasks.
7. Render derived `Skipped` versus `Completed` outcome on task details and
   History while hiding all reserved marker labels from ordinary label badges.

Checkpoint: focused Vitest tests, typecheck, and browser checks pass at phone,
tablet, and desktop widths with keyboard and screen-reader semantics intact.

### Phase 4: Real-state verification

8. Extend deterministic fixtures, token scopes if required, and Playwright
   coverage. Compare the visible UI with direct Vikunja v2 state for Skip,
   normal completion, active deletion, recurring-series deletion with retained
   history, confirmation cancellation, and direct GraphQL rejection of history
   deletion.
9. Regenerate embedded Vite assets and run the complete gates after the final
   edit: `task gen:check`, `task validate`, `task test`, and `task e2e`.

Checkpoint: every acceptance criterion passes against a fresh isolated
Vikunja 2.5.0 SQLite instance in Chromium and the existing required WebKit
coverage.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Skip renews successfully but its marker write fails | High | Seal outcome in repair capability; reconcile snapshot key; never repeat native renewal |
| Complete and Skip race on one live occurrence | High | Keep atomic JSON Patch tests on done, due, and recurrence fields; one renewal wins |
| Repair mistakes a completed snapshot for skipped | High | Validate required and forbidden outcome markers before accepting reconciliation |
| Delete removes a task completed by another client after the guard | Medium | Document Vikunja's missing conditional DELETE; serialize app actions; keep confirmation close to mutation |
| Deleting a recurring task removes prior history | High | Delete only the live task ID; assert independent snapshots remain through direct API E2E |
| Reserved markers appear as user labels | Low | Add `vbu:skipped` to the shared reserved-label filter and test it |
| Apollo shows stale active or History state | Medium | Evict/refetch only after confirmed mutations and test Back/reload behavior |

## Boundaries

### Always

- Use Vikunja API v2 and preserve the browser -> GraphQL -> Vikunja boundary.
- Require session and CSRF validation for both mutations.
- Read authoritative upstream state before action and keep resolvers thin.
- Update schema, generated code, tests, documentation, and embedded assets
  together.
- Use failing focused tests before behavior changes and verify against the real
  pinned Vikunja binary.

### Ask first

- Add a dependency or application persistence.
- Change native recurrence advancement, Undo behavior, or History retention.
- Make History mutable or expose deletion recovery.
- Change the GraphQL contract incompatibly.

### Never

- Attach `vbu:skipped` to the renewed live task.
- Add a task comment for Skip.
- Retry native recurring completion after an ambiguous or partial success.
- Allow GraphQL deletion of a completed or marker-owned history task.
- Claim the upstream active-only DELETE guard is atomic across clients.

## Open questions

None. Implementation starts only after this plan is reviewed and approved.
