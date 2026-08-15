# Keep Due Time Implementation Checklist

## Task 1: Define the reserved marker and compatibility rules

**Description:** Add `vbu:fixed-due-time` to the service marker model and
derive whether it is enabled and valid from authoritative task state.

**Acceptance criteria:**

- [ ] Exact-title marker resolution remains deterministic.
- [ ] Only active, timed, mode-2, positive whole-day day/week recurrence accepts
  the marker.
- [ ] Every incompatible marked combination classifies invalid and cannot
  Complete or Skip.
- [ ] The marker is recognized as reserved without affecting unmarked tasks.

**Verification:** Table-driven service tests cover valid, absent, duplicate,
date-only, scheduled, monthly, history, completed, job, and malformed cases.

**Dependencies:** None.

**Files likely touched:**

- `internal/service/markers.go`
- `internal/service/markers_test.go`
- `internal/service/task_kind.go`
- `internal/service/task_kind_test.go`

**Estimated scope:** Medium, 4 files.

## Task 2: Implement the calendar-time target resolver

**Description:** Add a pure function that combines the captured completion
local date plus whole calendar days with the completed occurrence's local due
clock.

**Acceptance criteria:**

- [ ] Day and week intervals preserve local hour, minute, second, and timezone.
- [ ] Early and late completion use the same future local due time.
- [ ] DST offset changes preserve wall time and may produce 47/49-hour elapsed
  durations.
- [ ] Missing/ambiguous wall times, nil timezone, invalid intervals, and date
  overflow are rejected.

**Verification:** Focused table tests include the exact spec examples and
Europe/Kiev DST boundaries.

**Dependencies:** None.

**Files likely touched:**

- `internal/service/fixed_due_time.go`
- `internal/service/fixed_due_time_test.go`
- `internal/service/local_time.go` only if a reusable seconds-precision helper
  is required.
- `internal/service/local_time_test.go` only with the preceding helper change.

**Estimated scope:** Medium, 2-4 files.

## Task 3: Bind recurring actions to one occurrence

**Description:** Require the currently displayed due instant for recurring
Complete and Skip and reject stale or replayed actions before mutation.

**Acceptance criteria:**

- [ ] A matching expected due instant permits the workflow.
- [ ] Missing, changed, or replayed recurring occurrence identity returns a
  conflict before any upstream patch.
- [ ] One-time and job completion behavior remains unchanged.
- [ ] Both Complete and Skip use the same service precondition.

**Verification:** Service and resolver tests assert exact upstream call counts,
including zero writes on every rejected case.

**Dependencies:** Task 1.

**Files likely touched:**

- `internal/service/recurring_completion.go`
- `internal/service/recurring_completion_test.go`
- `internal/graphql/schema/schema.graphqls`
- `internal/graphql/resolver/mutation_helpers.go`
- Relevant resolver tests; generated outputs are mechanical.

**Estimated scope:** Medium, 4 source/test areas plus generated output.

## Checkpoint 1: Pre-write safety

- [ ] Focused service and resolver tests pass.
- [ ] Review confirms stale occurrences, invalid markers, and invalid timezone
  targets produce zero upstream writes.

## Task 4: Normalize fixed-time renewal safely

**Description:** Precompute the target from one captured action instant, run
native renewal once, verify it, and apply a checked due-date patch when enabled.

**Acceptance criteria:**

- [ ] Enabled Complete and Skip produce the exact target from the spec.
- [ ] Strict elapsed, scheduled cycle, monthly, and date-only behavior is
  unchanged.
- [ ] The normalization patch checks authoritative done/due/recurrence state,
  refetches, and confirms the result.
- [ ] A native renewal mismatch never proceeds to normalization or archival.

**Verification:** Focused tests cover success, checked conflicts, rejected
responses, action-time anchoring, and unchanged legacy modes.

**Dependencies:** Tasks 1-3.

**Files likely touched:**

- `internal/service/recurring_completion.go`
- `internal/service/recurring_completion_test.go`
- `internal/service/fixed_due_time.go`
- `internal/service/fixed_due_time_test.go`

**Estimated scope:** Large, 4 files.

## Task 5: Make post-renewal repair idempotent

**Description:** Extend sealed repair state so it can finish due normalization
and History reconciliation without invoking native completion again.

**Acceptance criteria:**

- [ ] The grant binds task, renewed `done_at`, recurrence fields, native due,
  optional target due, completion key, original snapshot dates, and outcome.
- [ ] Repair accepts only native-pending or already-normalized due state; any
  other live state conflicts.
- [ ] Retrying after each partial boundary converges to one normalized live task
  and one valid History snapshot.
- [ ] No repair path calls native completion.

**Verification:** Capability round-trip/tamper tests and failure-injection
service tests cover every post-renewal boundary.

**Dependencies:** Task 4.

**Files likely touched:**

- `internal/service/capability.go`
- `internal/service/capability_test.go`
- `internal/service/recurring_completion.go`
- `internal/service/recurring_completion_test.go`

**Estimated scope:** Large, 4 files.

## Task 6: Keep the marker out of History

**Description:** Centralize snapshot label-copy eligibility and exclude the
fixed-time marker during initial creation and repair.

**Acceptance criteria:**

- [ ] The renewed live series retains the marker.
- [ ] New and partially repaired completed/skipped snapshots never receive it.
- [ ] Existing user labels and outcome markers remain correct.
- [ ] Complete and Skip retain identical renewal timing.

**Verification:** Snapshot creation and repair tests inspect exact label IDs and
titles for both outcomes.

**Dependencies:** Tasks 1, 4, and 5.

**Files likely touched:**

- `internal/service/recurring_completion.go`
- `internal/service/recurring_completion_test.go`
- `internal/service/task_kind.go` only if the shared reserved-label predicate
  belongs there.
- `internal/service/task_kind_test.go` only with the preceding change.

**Estimated scope:** Small-medium, 2-4 files.

## Checkpoint 2: Renewal and recovery safety

- [ ] `go test ./internal/service -race` passes.
- [ ] Review confirms native completion occurs at most once per occurrence.
- [ ] Review confirms the fixed-time marker exists only on the live series.

## Task 7: Add label detach and active-series setting service

**Description:** Add the Vikunja detach-label operation and a confirmed,
idempotent service for enabling/disabling future fixed-time renewals.

**Acceptance criteria:**

- [ ] Detach uses the exact Vikunja v2 task-label endpoint and validates IDs and
  response status.
- [ ] Enable validates eligibility, resolves the marker, attaches at most once,
  and confirms by refetch.
- [ ] Disable removes every attached exact-title marker, including duplicates,
  and permits correction of incompatible marked state.
- [ ] Concurrent or partially applied changes return a safe conflict/retryable
  result without claiming success.

**Verification:** Adapter and service tests cover HTTP method/path, idempotency,
duplicates, partial failure, incompatible enablement, and authoritative
confirmation.

**Dependencies:** Task 1.

**Files likely touched:**

- `internal/vikunja/api.go`
- `internal/vikunja/api_test.go`
- `internal/service/recurrence_setting.go`
- `internal/service/recurrence_setting_test.go`

**Estimated scope:** Medium, 4 files.

## Task 8: Expose the typed GraphQL contract

**Description:** Add typed setting state/input and a focused active-series
mutation without exposing label implementation details.

**Acceptance criteria:**

- [ ] `RecurrenceRule.keepDueTime` is non-null and derived server-side.
- [ ] Recurring creation accepts `keepDueTime` with a default of `true` and
  rejects inapplicable explicit enablement before task creation.
- [ ] The setting mutation requires session/CSRF, returns the confirmed task,
  and maps validation, conflict, and upstream failures safely.
- [ ] Recurring Complete and Skip carry occurrence identity through the typed
  contract.

**Verification:** Run `task gen`; focused resolver tests cover authorization,
validation, success, marker-repair state, disable-correction, and errors; then
run `task gen:check`.

**Dependencies:** Tasks 3, 5, and 7.

**Files likely touched:**

- `internal/graphql/schema/schema.graphqls`
- `internal/graphql/resolver/schema.resolvers.go`
- `internal/graphql/resolver/mutation_helpers.go`
- `internal/graphql/resolver/task_model.go`
- Relevant resolver tests and reproducibly generated files.

**Estimated scope:** Large, 4 source files plus focused/generated tests.

## Task 9: Persist the default during recurring creation

**Description:** Route eligible creation through existing marker resolution,
attachment, confirmation, and repair behavior.

**Acceptance criteria:**

- [ ] A new timed From-completion day/week task defaults to an attached marker.
- [ ] Explicit disabled creation produces an unmarked strict-elapsed task.
- [ ] Date-only, scheduled-cycle, and monthly creation never attach the marker.
- [ ] Attachment failure returns the existing retry-safe marker repair payload
  without creating a second task.

**Verification:** Builder, creation-workflow, and resolver tests inspect both
GraphQL payload and authoritative task labels.

**Dependencies:** Task 8.

**Files likely touched:**

- `internal/service/task_creation.go`
- `internal/service/task_creation_test.go`
- `internal/graphql/resolver/schema.resolvers.go`
- `internal/graphql/resolver/task_actions_resolver_test.go`
- `internal/service/create_workflow_test.go` if marker repair coverage changes.

**Estimated scope:** Medium, 4-5 files.

## Checkpoint 3: Backend vertical slice

- [ ] `task gen:check` passes.
- [ ] `go test ./internal/service ./internal/vikunja ./internal/graphql/resolver -race`
  passes.
- [ ] Schema review confirms callers use a setting, not a marker label.

## Task 10: Add the creation setting UI

**Description:** Add a conditional, controlled **Keep due time** option to the
recurring-task form and submit the typed setting.

**Acceptance criteria:**

- [ ] The option appears only for timed From-completion day/week input.
- [ ] It defaults on when eligible and cannot submit a stale enabled value after
  becoming ineligible.
- [ ] Helper text distinguishes local calendar scheduling from exact elapsed
  duration.
- [ ] Client validation matches server eligibility rules.

**Verification:** Focused form/component tests cover due-time, mode, and unit
transitions; keyboard behavior and narrow layout are inspected.

**Dependencies:** Tasks 8 and 9.

**Files likely touched:**

- `frontend/src/features/tasks/create-type-fields.tsx`
- `frontend/src/features/tasks/create-task-page.tsx`
- `frontend/src/features/tasks/task-form-validation.ts`
- `frontend/src/features/tasks/task-form-validation.test.ts`
- `frontend/src/features/tasks/create.graphql`; generated files are mechanical.

**Estimated scope:** Medium, 5 source/test files plus generated output.

## Task 11: Add the active-series setting UI

**Description:** Present and update the setting on active recurring task
details with future-only semantics.

**Acceptance criteria:**

- [ ] Eligible active recurring details show the confirmed current setting.
- [ ] Saving disables competing controls, announces progress/result, and
  refetches task/list data only after confirmation.
- [ ] Copy states that the change affects future renewals and does not rewrite
  the current due date or History.
- [ ] An incompatible marked task can disable the setting but cannot enable it
  until its recurrence is eligible.

**Verification:** Focused policy/component tests cover enabled, disabled,
ineligible, invalid-corrective, loading, success, and failure states; browser
inspection covers keyboard and responsive behavior.

**Dependencies:** Task 8.

**Files likely touched:**

- `frontend/src/features/tasks/task.graphql`
- `frontend/src/features/tasks/task-detail-page.tsx`
- `frontend/src/features/tasks/task-recurrence-setting.tsx`
- `frontend/src/features/tasks/task-recurrence-setting.test.tsx`
- `frontend/src/features/tasks/task-detail-action-policy.ts` and its test only
  if action coordination belongs there.

**Estimated scope:** Medium, 4-5 files plus generated output.

## Task 12: Hide the reserved marker everywhere ordinary labels appear

**Description:** Add the new marker to the shared visible-label filter and
verify every current label surface uses it.

**Acceptance criteria:**

- [ ] `vbu:fixed-due-time` never renders as an ordinary badge.
- [ ] User labels with similar but non-exact titles remain visible.
- [ ] Existing reserved markers remain hidden.

**Verification:** Focused filter tests plus task-list/detail browser assertions.

**Dependencies:** Task 1.

**Files likely touched:**

- `frontend/src/features/tasks/visible-task-labels.ts`
- `frontend/src/features/tasks/visible-task-labels.test.ts`
- Any ordinary label surface found not to use the shared helper.

**Estimated scope:** Small, 2-3 files.

## Checkpoint 4: Complete application experience

- [ ] Focused Vitest tests pass.
- [ ] Frontend lint and typecheck pass.
- [ ] Human review confirms clear wording, keyboard use, and phone/desktop
  layout.

## Task 13: Prove behavior against Vikunja 2.5.0

**Description:** Extend fixtures and Playwright coverage to compare visible
behavior with direct upstream task/label state.

**Acceptance criteria:**

- [ ] Enabled early/late Complete and Skip preserve the original local due
  time on the completion-relative date.
- [ ] Disabled mode remains exact elapsed; scheduled cycle remains unchanged.
- [ ] Enabling/disabling affects only future renewal and persists through
  reload.
- [ ] The live task ID remains stable, its marker persists when enabled, and
  completed/skipped History excludes it.
- [ ] Stale actions and invalid timezone targets make zero upstream mutation.
- [ ] Repair after injected post-renewal failure normalizes once, produces at
  most one History snapshot, and never renews again.

**Verification:** Run focused Chromium cases, then full `task e2e` against a
fresh isolated Vikunja instance.

**Dependencies:** Tasks 4-12.

**Files likely touched:**

- `tests/e2e/harness/fixtures.mjs`
- `frontend/e2e/app.spec.ts`
- `tests/e2e/harness/run.sh` only if deterministic failure injection needs a
  harness control.
- Focused Go integration tests if network-boundary fault injection is clearer
  there.

**Estimated scope:** Large, 2-4 files.

## Task 14: Update permissions and product documentation

**Description:** Document the shipped behavior, active-series setting, exact
elapsed alternative, recovery semantics, and additional label-delete scope.

**Acceptance criteria:**

- [ ] README token permissions include `tasks_labels:delete` and match E2E.
- [ ] README examples and the product spec match the implemented UI/API.
- [ ] The spec status changes from implementation pending only after all
  behavior is verified.
- [ ] No real credentials or internal capabilities are documented.

**Verification:** Review links, commands, examples, permission tables, and
terminology against the generated schema and passing E2E behavior.

**Dependencies:** Tasks 7-13.

**Files likely touched:**

- `README.md`
- `docs/specs/keep-due-time.md`
- `tests/e2e/harness/fixtures.mjs`

**Estimated scope:** Small, 3 files.

## Task 15: Regenerate and run final gates

**Description:** Format, regenerate, validate, test, and inspect the complete
change after the final edit.

**Acceptance criteria:**

- [ ] Generated gqlgen, frontend GraphQL, route, and embedded asset files are
  current and reproducible.
- [ ] No unrelated generated bundle or user change is removed.
- [ ] All required checks pass after the final code/document edit.
- [ ] Human review confirms every spec success criterion and no out-of-scope
  feature expansion.

**Verification:** Run `task fix`, `task gen`, `task gen:check`, `task validate`,
`task test`, and `task e2e` inside the Dev Container; record any unavailable or
failed gate accurately.

**Dependencies:** Tasks 1-14.

**Files likely touched:** Reproducibly generated GraphQL and embedded frontend
outputs only.

**Estimated scope:** Mechanical generated output and verification.

## Final human review

- [ ] Product behavior matches all exact examples.
- [ ] Complete and Skip share one timing implementation.
- [ ] No stale/retry path can renew an occurrence twice.
- [ ] No fixed-time marker appears in History or ordinary label UI.
- [ ] Strict elapsed and scheduled-cycle behavior did not regress.
- [ ] Documentation and minimum token permissions match shipped behavior.
