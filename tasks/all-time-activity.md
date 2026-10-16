# All-time public activity

## Contract and implementation plan

Keep existing plans untouched. Implement `/all-time-activity` as an independent,
default-off public view enabled only by `PUBLIC_ALL_TIME_ACTIVITY=true`.
No dependency, persistence, user-selected range or upstream URL is added.

### Priority selection and weekly labels

- Select one or several priorities locally; initially all six are selected.
  An explicit All priorities action restores that selection. Selecting none
  shows no data, never silently switches back to all.
- Add per-priority count/deadline/on-time buckets to each weekly aggregate in
  the existing scan. No new Vikunja calls, query arguments or cache variants.
  All charts and all-time totals use the same selected cohort.
- Label each week Monday–Sunday. Position weekly samples at the center of their
  seven-day bins, including a single-week chart; disclose the current partial
  week. Keep zero-count weeks so filtering cannot collapse the time axis.
- Verify aggregation, multi-selection, weighted percentages, empty selection,
  interval labels/geometry, keyboard/mobile behavior and no extra requests.

Implemented and verified: 298 frontend unit tests and 463 E2E cases passed,
including 12 focused Activity cases on Chromium/WebKit. Go race tests include
100,000 completions with unchanged 1001 upstream calls per refresh. A mutation
reversing priority inclusion fails the reducer tests. The actual Apollo operation
(including typename selections) is checked under the unchanged complexity limit;
the browser omits redundant weekly totals and derives them from priority cohorts.
The 100,000-task synthetic reducer benchmark measured approximately 12.9 ms,
9.48 MB cumulative allocations, 1017 allocations; this is not peak RSS or network time.

- [x] Validate the independent flag and require stable Vikunja >=2.7.0 at startup.
- [x] Scan completed tasks once, page by page, using API v2 without expansions.
  Aggregate by Monday-start calendar weeks in the token owner's timezone. Preserve
  the existing on-time definition, skipped exclusion and equal priority weights.
  Fill empty weeks; current week is partial. Deleted/native-renewed history remains unavailable.
- [x] Cache one immutable aggregate for one hour per process; coalesce refreshes.
  Bound waiting readers (16), public reads (20 per second), scan (20 seconds,
  1000 pages of at most 100 records), and output (5200 calendar weeks). Fail without
  partial success; use a five-minute failure cooldown. No growing visitor/IP map.
- [x] Add argument-free GraphQL `publicAllTimeActivity`, returning null when off.
  Charge high GraphQL complexity for this root so aliases cannot multiply output.
- [x] Build weekly completion and on-time charts, priority totals, partial-week
  and cache disclosure. Browse 13 weeks at a time locally, without further queries.
- [x] Test DST/week boundaries, rate/concurrency limits, cache/cooldown, huge data,
  disabled/privacy boundaries, versions, and responsive browser rendering.
- [x] Run generation checks, validation, tests, browser checks, review/simplify.

## Source research

Pinned `v2.7.0/pkg/swagger/swagger.json` has no public aggregate, group-by or
task-field projection endpoint. `GET /tasks` supports filtering and pagination;
one all-history scan uses fewer requests than issuing a query per week. Reduce
each page immediately; never retain task descriptions/comments or task history.
Source: https://raw.githubusercontent.com/go-vikunja/vikunja/v2.7.0/pkg/swagger/swagger.json

Limits are per process; multiple replicas multiply them. This bounds application
work, not volumetric DDoS. Operators still need ingress/body/connection/rate
limits. TTL is an explicit privacy window after upstream deletion or revocation.
Do not cache stale success after a failed refresh. If safety limits are exceeded,
report unavailable rather than misleadingly labeling a truncated scan all-time.

## Verification and review

- Final code passed focused Go race tests, `task gen:check`, `task validate`,
  and `task test` (Go twice with race/shuffle, 295 frontend tests).
- Initial full `task e2e`: 459 passed, 1 failed in 9.2 minutes. All 15 Activity
  browser checks passed. Follow-up isolated repeats reproduced the pagination
  setup failure on Chromium as well as WebKit. Pinned Vikunja's server log
  confirmed `database is locked` / HTTP 500 during its 51 setup POST requests.
- Pagination setup now uses one guarded, fixture-only `BEGIN IMMEDIATE`
  transaction. All existing browser assertions remain; real create/edit and
  uncertain-save scenarios remain separate. Tests cover transaction rollback,
  author/reply identities, ordering, foreign database rejection and ownership.
  A Go regression verifies an upstream 500 is not automatically retried.
  This does not patch upstream SQLite or weaken production confirmation checks.
- Full-suite follow-up also exposed an inline-editor test synchronization race:
  `Save` disappears as soon as it becomes `Saving…`, before persistence finishes.
  The shared test helper now waits for `Changes saved.` before reading back the
  task. The captured browser trace confirmed the update and fresh `JOB` response;
  the premature test read was not a lost production update.
- Final verification after the code fixes: `task gen:check`, `task validate`,
  `task test` (Go race/shuffle twice and 295 frontend tests), and `task e2e`
  (460/460, 8.4 minutes) all passed. Focused repeats passed 50/50 pagination
  cases across five browser configurations and 20/20 inline-property cases on
  WebKit/tablet. Removing the fixture database-path guard made its regression
  test fail; restoring it returned the tests to green. Review/simplification
  preserved production behavior and every existing browser assertion.
  The timezone WebKit scenario still logs a CSP stylesheet warning despite
  passing; this fix does not claim that warning is resolved.
- 10,000-record HTTP fixture, 100 concurrent visitors: exactly 101 upstream
  requests (one user + 100 pages); overload is rejected and warm reads add zero.
- 100,000-record reducer: 1,001 client calls, about 14.1 ms, 9.48 MB cumulative
  allocations and 1,014 allocations per scan on Linux arm64. These are synthetic
  reducer timings/allocated bytes, not network latency, retained RAM or peak RSS.
- Review retained explicit scan/output bounds and verified privacy/alias limits.
  Simplification shares the keyboard-scroll viewport and priority/on-time charts
  instead of duplicating them. The first browser check caught and fixed a Safari
  keyboard-scroll accessibility issue. A later invalid run was traced to parallel
  Vite builds racing Go embed; final generation/test/E2E commands ran sequentially.
- Preview `/all-time-activity` uses real local Vikunja aggregates and randomized
  demo history. No dependencies, commits, pushes or releases were added.
