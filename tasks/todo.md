# Skip Recurrence and Delete Active Task Checklist

## Task 1: Define marker and outcome semantics

**Description:** Add `vbu:skipped` to the reserved marker model and derive a
completion outcome without changing task kinds.

**Acceptance criteria:**

- [x] A completed recurrence-history snapshot with `vbu:skipped` derives
  `SKIPPED`; other completed tasks derive `COMPLETED`; active tasks have no
  outcome.
- [x] Skipped without completed recurrence history is invalid.
- [x] Reserved marker selection remains exact-title and deterministic.

**Verification:**

- [x] Focused service tests pass inside the Dev Container.

**Dependencies:** None.

**Files likely touched:**

- `internal/service/markers.go`
- `internal/service/markers_test.go`
- `internal/service/task_kind.go`
- `internal/service/task_kind_test.go`

**Estimated scope:** Medium, 4 files.

## Task 2: Make recurring archival outcome-aware

**Description:** Parameterize recurring completion and repair by completion
outcome so Skip reuses native renewal safely.

**Acceptance criteria:**

- [x] Normal completion creates one history-only snapshot; Skip creates one
  snapshot with both history and skipped markers.
- [x] The live task renews exactly once and never receives the skipped marker.
- [x] Partial Skip repair preserves its outcome, rejects a conflicting
  snapshot, and never renews again.

**Verification:**

- [x] New service and capability tests fail before implementation and pass
  afterward.

**Dependencies:** Task 1.

**Files likely touched:**

- `internal/service/recurring_completion.go`
- `internal/service/recurring_completion_test.go`
- `internal/service/capability.go`
- `internal/service/capability_test.go`

**Estimated scope:** Medium, 4 files.

## Task 3: Guard and delete an active upstream task

**Description:** Add the Vikunja DELETE adapter and a service workflow that
rejects completed and history-marker tasks before deletion.

**Acceptance criteria:**

- [x] The adapter sends `DELETE /api/v2/tasks/{id}`, requires a successful
  response, and does not expect a deleted task representation.
- [x] Completed, recurrence-history, and skipped-marker tasks never reach the
  adapter delete call.
- [x] Active one-time, job, recurring, and invalid active tasks can be deleted.

**Verification:**

- [x] Focused adapter and service tests pass.

**Dependencies:** Task 1.

**Files likely touched:**

- `internal/vikunja/api.go`
- `internal/vikunja/api_test.go`
- `internal/service/deletion.go`
- `internal/service/deletion_test.go`

**Estimated scope:** Medium, 4 files.

## Checkpoint 1: Domain safety

- [x] `go test ./internal/service ./internal/vikunja` passes in the Dev
  Container.
- [x] Review confirms no duplicate renewal path and no mutation of History.

## Task 4: Expose strict GraphQL actions

**Description:** Add typed Skip and Delete mutations, derived outcome, repair
states, and safe error mapping.

**Acceptance criteria:**

- [x] `skipRecurringTask` accepts only CSRF plus task ID and returns the existing
  completion payload with explicit outcome.
- [x] `deleteTask` returns only the deleted ID and emits `TASK_NOT_ACTIVE` for
  every completed or history-marker task.
- [x] Authentication, CSRF, invalid ID, wrong kind, conflict, partial repair,
  upstream failure, and success are covered without exposing upstream details.

**Verification:**

- [x] `task gen`, focused resolver tests, and `task gen:check` pass.

**Dependencies:** Tasks 2 and 3.

**Files likely touched:**

- `internal/graphql/schema/schema.graphqls`
- `internal/graphql/resolver/schema.resolvers.go`
- `internal/graphql/resolver/mutation_helpers.go`
- `internal/graphql/resolver/task_model.go`
- Resolver tests and reproducibly generated GraphQL files.

**Estimated scope:** Medium plus mechanical generated outputs.

## Task 5: Add task-detail Skip

**Description:** Put a one-click non-destructive Skip action beside `Extended`
only for active valid recurring tasks.

**Acceptance criteria:**

- [x] Skip is absent for completed, invalid, one-time, and job details.
- [x] One click disables competing task actions until the mutation resolves;
  no confirmation or Undo appears.
- [x] Confirmed and repair-required results use existing semantic feedback and
  refresh the affected Apollo data.

**Verification:**

- [x] Focused frontend tests and a real-browser task-detail flow pass.

**Dependencies:** Task 4.

**Files likely touched:**

- `frontend/src/features/tasks/task.graphql`
- `frontend/src/features/tasks/task-detail-page.tsx`
- Focused task-detail tests.

**Estimated scope:** Medium, 3 files.

## Task 6: Add routed Delete confirmation

**Description:** Add destructive Delete beside `Extended` for active tasks and
a semantic confirmation page.

**Acceptance criteria:**

- [x] The confirmation route names the task and preserves validated `returnTo`.
- [x] Cancel performs no mutation; confirm blocks repeat submission, waits for
  upstream success, evicts the deleted ID, and returns to origin.
- [x] Completed and History task details expose no Delete, and direct GraphQL
  attempts remain server-rejected.

**Verification:**

- [x] Route-search, component, keyboard, and real-browser confirmation tests
  pass at phone and desktop widths.

**Dependencies:** Task 4.

**Files likely touched:**

- `frontend/src/features/tasks/task.graphql`
- `frontend/src/features/tasks/delete-task-page.tsx`
- `frontend/src/routes/_authenticated.tasks.$taskId.delete.tsx`
- `frontend/src/features/tasks/task-detail-page.tsx`
- Focused route/component tests.

**Estimated scope:** Medium, 5 files plus generated route tree.

## Task 7: Present completion outcomes consistently

**Description:** Display `Skipped` distinctly in task details and History while
keeping reserved labels out of ordinary task badges.

**Acceptance criteria:**

- [x] History and completed details show `Skipped` or `Completed` from the typed
  outcome, not from frontend label parsing.
- [x] `vbu:skipped` is hidden with other reserved marker labels.
- [x] Layout remains consistent and does not overflow at existing breakpoints.

**Verification:**

- [x] Focused Vitest tests and responsive Playwright assertions pass.

**Dependencies:** Tasks 4, 5, and 6.

**Files likely touched:**

- `frontend/src/features/tasks/task-detail-page.tsx`
- `frontend/src/features/tasks/task-row.tsx`
- `frontend/src/features/tasks/visible-task-labels.ts`
- Corresponding focused tests.

**Estimated scope:** Medium, 4 files.

## Checkpoint 2: Complete application slices

- [x] `task gen:check` passes.
- [x] Focused Go and frontend tests pass.
- [x] Phone, tablet, and desktop action hierarchy is visually verified.

## Task 8: Prove behavior against Vikunja 2.5.0

**Description:** Extend isolated fixtures and E2E coverage to compare every new
visible outcome with direct upstream state.

**Acceptance criteria:**

- [x] Skip preserves the live task ID, follows native due advancement, creates
  exactly one completed non-recurring snapshot with both markers, and creates
  no comment.
- [x] Deleting an active recurring task removes the live series while prior
  completed and skipped snapshots remain queryable in History.
- [x] Confirmation cancellation writes nothing, active one-time deletion works,
  and direct GraphQL deletion of completed/history tasks is rejected without an
  upstream DELETE.

**Verification:**

- [x] Focused Playwright runs pass, followed by `task e2e`.

**Dependencies:** Tasks 5, 6, and 7.

**Files likely touched:**

- `tests/e2e/harness/fixtures.mjs`
- `frontend/e2e/app.spec.ts`
- Supporting test helpers only when existing helpers cannot express the state.

**Estimated scope:** Medium, 2-4 files.

## Task 9: Regenerate and complete the quality gate

**Description:** Regenerate all derived code and embedded assets, review the
diff, and run every applicable repository check after the final edit.

**Acceptance criteria:**

- [x] Generated gqlgen, GraphQL Codegen, route-tree, and Vite embed output is
  reproducible and committed with source changes when later requested.
- [x] Documentation matches the implemented contract and contains no stale
  comment-based Skip behavior.
- [x] No new dependency, secret, API v1 call, skipped test, or hand-edited
  generated file exists.

**Verification:**

- [x] `task gen:check`
- [x] `task validate`
- [x] `task test`
- [x] `task e2e`

**Dependencies:** Task 8.

**Files likely touched:** Generated GraphQL, route-tree, and embedded Vite
outputs plus any final documentation correction.

**Estimated scope:** Mechanical generated outputs and verification.

## Completion audit

- [x] Every task's acceptance criteria are met.
- [x] Runtime behavior is verified against an isolated Vikunja 2.5.0 instance.
- [x] The active-only DELETE race limitation remains documented.
- [ ] Human review approves the implementation before commit or merge.
