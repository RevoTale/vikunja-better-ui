# Completed Jobs Integration Checklist

## Task 1: Define and test request validation

**Description:** Extend the HTTP request contract with typed status and
completion boundaries while preserving active defaults.

**Acceptance criteria:**

- [x] Omitted and explicit `active` status produce the existing active request.
- [x] Completed status accepts exactly one valid RFC3339 value for each bound
  and requires a strictly increasing interval.
- [x] Invalid, duplicate, incompatible, or unknown parameters return the
  existing structured `400 INVALID_REQUEST` response.

**Verification:** Run the focused request-parser and integration handler tests
with `go test -race ./internal/integration` inside the Dev Container.

**Dependencies:** None.

**Files likely touched:**

- `internal/integration/jobs.go`
- `internal/integration/jobs_test.go`

**Estimated scope:** Small, 2 files.

## Task 2: Query and paginate completed Jobs correctly

**Description:** Add a bounded service path for completed, non-recurring Jobs
whose authoritative `done_at` falls in the requested half-open interval.

**Acceptance criteria:**

- [x] The Vikunja filter contains `done = true`, both `done_at` bounds, resolved
  Job label IDs, and `repeat_after = 0`.
- [x] Optional exact-label filtering and deterministic completion sorting occur
  before application pagination.
- [x] Existing active Jobs filtering, sorting, bounds, and pagination remain
  unchanged.

**Verification:** Run race-enabled focused service tests covering boundaries,
multiple upstream pages, duplicate label titles, stable sorting, totals, and
the candidate ceiling.

**Dependencies:** Task 1.

**Files likely touched:**

- `internal/service/list_workflow.go`
- `internal/service/list_workflow_test.go`
- `internal/service/task_list.go`
- `internal/service/task_list_test.go`

**Estimated scope:** Medium, 4 files.

## Checkpoint 1: Contract and workflow

- [x] Focused integration and service tests pass under `-race`.
- [x] Review confirms both interval edges and pagination order are correct.
- [x] Review confirms active Jobs follow the unchanged code path.

## Task 3: Expose the unified response shape

**Description:** Add nullable `doneAt` to every Job item and populate it for
completed responses.

**Acceptance criteria:**

- [x] Active items encode `doneAt` as JSON `null`.
- [x] Completed items encode the authoritative completion instant as RFC3339.
- [x] Every existing response field, header, status, and error shape remains
  unchanged.

**Verification:** Integration tests decode both variants and assert exact item
values, response metadata, cache headers, and upstream authorization.

**Dependencies:** Task 2.

**Files likely touched:**

- `internal/integration/jobs.go`
- `internal/integration/jobs_test.go`

**Estimated scope:** Small, 2 files.

## Task 4: Document Glance usage and compatibility

**Description:** Document completed-week queries, stable response fields,
half-open boundary semantics, errors, sorting, and permissions.

**Acceptance criteria:**

- [x] README includes an encoded Europe/Kyiv weekly example and Glance custom
  API configuration for completed Jobs.
- [x] MVP specification and Jobs ADR describe the completed extension and why
  caller-supplied absolute boundaries are used.
- [x] Documentation explicitly states that old requests still default to
  active Jobs and that token permissions are unchanged.

**Verification:** Compare every documented parameter, field, and error with the
handler contract tests.

**Dependencies:** Task 3.

**Files likely touched:**

- `README.md`
- `docs/specs/mvp.md`
- `docs/decisions/0004-read-only-jobs-integration.md`

**Estimated scope:** Medium, 3 files.

## Checkpoint 2: Complete feature

- [x] Focused tests pass after the final edit.
- [x] `task gen:check` passes.
- [x] `task validate` passes.
- [x] `task test` passes.
- [x] Code review finds no backward-compatibility, security, pagination, or
  performance regressions.
- [x] Simplification review finds no unnecessary abstraction or duplicated
  status-specific workflow.
