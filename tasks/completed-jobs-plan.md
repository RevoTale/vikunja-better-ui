# Implementation Plan: Query Completed Jobs by Completion Time

## Outcome

Extend `GET /integrations/v1/jobs` so Glance can request completed Jobs within
caller-supplied absolute RFC3339 boundaries. Existing requests continue to
return active Jobs with unchanged filtering, ordering, pagination,
authentication, and permissions. Every item uses one stable response shape
with nullable `doneAt`.

This plan defines implementation order and verification. It does not implement
the feature.

## Agreed contract

```http
GET /integrations/v1/jobs
  ?status=completed
  &completedFrom=2026-08-24T00:00:00%2B03:00
  &completedBefore=2026-08-31T00:00:00%2B03:00
  &label=dashboard
  &page=1
  &pageSize=100
Authorization: Bearer <Vikunja API token>
```

- `status` accepts `active` and `completed`; omission means `active`.
- `status=completed` requires exactly one `completedFrom` and one
  `completedBefore` value.
- Both timestamps must be valid RFC3339 instants and `completedFrom` must be
  strictly earlier than `completedBefore`.
- Completion filtering is `completedFrom <= doneAt < completedBefore`.
- Completion parameters with active status are rejected instead of ignored.
- Active Jobs retain their current ordering. Completed Jobs sort by `doneAt`
  descending, then task ID descending.
- Existing exact `job` marker, non-recurring-task, caller permission, optional
  exact-label, pagination, cache, and error semantics remain authoritative.
- Every item contains `doneAt`; it is `null` for active Jobs and an RFC3339
  timestamp for completed Jobs.
- The caller calculates timezone and DST boundaries. Better UI treats them as
  absolute instants.
- The existing caller-token permission set remains sufficient.

## Architecture decisions

- Extend the existing versioned resource instead of creating a second endpoint.
  The new query parameters are additive and the default status preserves old
  behavior.
- Parse and validate all new parameters once at the HTTP boundary. Internal
  workflows receive typed status and `time.Time` boundaries.
- Keep the active Jobs workflow unchanged except for mapping `doneAt: null`.
  This minimizes regression risk for existing consumers.
- Push `done = true`, `done_at >= completedFrom`, `done_at < completedBefore`,
  the resolved Job label IDs, and `repeat_after = 0` into Vikunja's task filter.
- Preserve exact optional-label semantics before pagination. Because one exact
  title may resolve to multiple Vikunja label IDs, load the bounded completed
  Job candidate set, apply the secondary label match locally, sort
  deterministically, and only then paginate.
- Reuse the existing bounded candidate limit and parallel upstream page loading
  so a broad request fails safely rather than consuming unbounded memory.
- Add no database, cache, dependency, GraphQL change, browser change, new token
  permission, or caller-selected timezone.

## Request path

```text
HTTP query validation
  ├─ status omitted/active
  │    └─ existing active Jobs workflow and ordering
  └─ status=completed + valid half-open interval
       └─ Vikunja: done + done_at range + job marker + non-recurring
            └─ parallel bounded page load
                 └─ optional exact-label filter
                      └─ doneAt DESC, id DESC
                           └─ application pagination and unified JSON mapping
```

## Implementation phases

### Phase 1: Lock the public contract with failing tests

1. Add request-parser and handler contract tests for default active behavior,
   explicit active behavior, completed intervals, duplicate/unknown parameters,
   invalid statuses, malformed timestamps, missing bounds, reversed/equal
   ranges, and completion parameters supplied to active requests.
2. Extend response assertions so active items expose `doneAt: null` and
   completed items expose their authoritative completion instant.

Checkpoint: focused integration tests fail only because completed status and
the unified field are not implemented; legacy active expectations otherwise
remain unchanged.

### Phase 2: Add the bounded completed Jobs workflow

3. Add typed status and completion boundaries to the integration request and
   service list request. Build the completed upstream filter using formatted
   absolute RFC3339 values rather than timezone-relative expressions.
4. Reuse bounded parallel candidate loading, canonical Job classification,
   optional exact-label filtering, deterministic completion sorting, and
   pagination. Keep the active workflow and its ordering isolated from this
   branch.

Checkpoint: service tests prove filtering occurs before pagination, interval
edges are inclusive/exclusive, secondary labels remain exact, and completed
results are ordered before paging.

### Phase 3: Map and document the public response

5. Add nullable `doneAt` to `jobResponse` and map the authoritative Vikunja
   value only for completed Jobs. Confirm Go JSON encoding produces RFC3339
   timestamps and `null` for active rows.
6. Update the README integration guide, Glance examples, MVP contract, and the
   Jobs integration ADR with status semantics, half-open boundaries, stable
   response shape, errors, sorting, and unchanged permissions.

Checkpoint: handler tests exercise both active and completed requests through
an HTTP Vikunja fixture and assert the exact upstream filter, sort, response,
pagination, authorization, and error shape.

### Phase 4: Full verification and review

7. Run focused race-enabled tests, then `task gen:check`, `task validate`, and
   `task test` inside the existing Dev Container after the final edit.
8. Review for backward compatibility, boundary validation, credential safety,
   pagination correctness, upstream call bounds, and unnecessary complexity;
   simplify without changing behavior and rerun all affected checks.

Checkpoint: every acceptance criterion passes, documentation matches runtime
behavior, generated assets are current, and the working tree contains only
feature-related changes.

## Test matrix

| Request | Expected result |
| --- | --- |
| No new parameters | Existing active Jobs behavior; `doneAt: null` |
| `status=active` | Same as omitted status |
| Completed with valid bounds | Only `from <= doneAt < before` Jobs |
| Completion exactly at `completedFrom` | Included |
| Completion exactly at `completedBefore` | Excluded |
| Completed plus exact label | Both Job and requested label required before pagination |
| Unknown optional label | Complete empty page |
| Missing one or both completed bounds | Structured `400 INVALID_REQUEST` |
| Equal or reversed bounds | Structured `400 INVALID_REQUEST` |
| Malformed/duplicate status or timestamp | Structured `400 INVALID_REQUEST` |
| Completion bound with active status | Structured `400 INVALID_REQUEST` |
| Candidate set exceeds bound | Existing structured `422 RESULT_SET_TOO_LARGE` |
| Rejected or underprivileged token | Existing `401` or `403` response |

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Adding a field affects a strict legacy decoder | Low | Chosen stable unified shape is additive; preserve every existing field and behavior and document the addition |
| Secondary label filtering after upstream pagination corrupts totals | High | Load the bounded range, apply exact label filtering and sorting, then paginate locally |
| Sorting only within a returned page produces unstable history | High | Sort the complete bounded candidate set by `doneAt DESC, id DESC` before pagination |
| Broad intervals cause excessive upstream work or memory | Medium | Require both bounds, push the range upstream, retain the candidate ceiling, and load pages with bounded concurrency |
| Timestamp boundary is interpreted in server timezone | High | Parse RFC3339 to absolute instants and send explicit formatted timestamps; do no local week calculation |
| Active ordering changes accidentally | Medium | Keep a separate active branch and retain explicit legacy regression tests |

## Open questions

None. The contract is ready for implementation after plan approval.
