# Public activity: on-time completion

Status: implemented and locally verified; no commit, push or release performed.

## Implementation checklist

- [x] Add reducer baseline benchmarks and failing metric/cache regression tests.
- [x] Extend bounded decoding and daily aggregates; change TTL to one hour.
- [x] Extend GraphQL additively and regenerate types; test anonymous fields.
- [x] Add the daily percentage chart, matching skeleton and browser tests.
- [x] Verify large-dataset request counts, cache hits and resource measurements.
- [x] Update product documentation; review, simplify and re-review.
- [x] Run final focused checks, generation, validation, tests and real E2E.

## Objective

Add one daily on-time completion percentage to the existing public Activity
page. Reuse the current Vikunja completion scan and increase the shared aggregate
cache TTL from ten minutes to one hour.
Do not present the percentage as a measure of personal worth or quality of life.

## Metric contract

- Keep the existing fourteen-calendar-day window and token owner's timezone.
- Group records by the local calendar date of `done_at`, not `due_date`.
- Eligible records are completed tasks with a nonzero `due_date`.
- A completion is on time when `done_at <= due_date`, including exact equality.
- Percentage is `100 * onTime / eligible`. Do not average daily percentages
  when computing an overall period percentage; divide the period totals.
- Zero eligible records means no data, never 0% or 100%.
- Include stored completed recurrence-history snapshots with their original
  due date; exclude skipped snapshots and renewed live tasks as today.
- Do not invent native recurrence history, computed occurrences, or deadlines.
- Do not use `start_date` or `end_date` as a fallback deadline.
- All priorities have equal weight. No arbitrary success weights or thresholds.
- Preserve the existing completion-count and priority-distribution charts.
- Add one daily percentage chart with sample counts, missing-data gaps, and a
  note that today's result covers completions recorded so far.

This is **on-time completion among completed tasks**, not adherence among all
tasks due that day. Unfinished overdue work is outside its denominator. Clearing
old late tasks can lower the percentage despite useful progress. Editing due
dates, deleting tasks, or completing recurrence outside Better UI can affect
the available historical evidence. Explain these limits in the product docs.

## API and resource budget

Keep `React -> Go GraphQL -> Vikunja REST`. Extend the existing public schema
additively with anonymous per-day eligible/on-time counts. Use `due_date` from
the task-list response; do not request individual task details or new lists.

- Additional upstream requests and task-response bandwidth: zero.
- Cache hits: zero upstream requests, as before.
- Reduce one page of at most 100 tasks at a time. Add two integer counters per
  day; never retain a task collection or introduce persistence.
- Use a one-hour TTL for the entire Activity aggregate, including existing
  charts. Data may be up to one hour old; keep the snapshot timestamp visible
  and update the page copy, README, and cache-expiry tests consistently.
- Preserve single-flight refreshes, the 20-second timeout,
  1,000-page limit, response-size bounds, cancellation behavior and cooldown.
- Keep the existing opt-in environment variable and anonymous aggregate-only
  output. No new dependencies, public query parameters, or permissions.
- Verify the unchanged request count with tests. Compare allocations and
  execution time against the current reducer before claiming measured gains.

## Source and test locations

- Decode completion facts in `internal/vikunja/activity.go`.
- Reduce/cache in `internal/service/public_activity.go`.
- Extend `internal/graphql/schema/activity.graphqls` and its resolver; regenerate
  gqlgen and frontend operation types, never edit generated code manually.
- Keep presentation under `frontend/src/features/activity/`; match the new
  chart's skeleton geometry and avoid page overflow. Use a 14-day line chart
  with a fixed 0–100% axis, gaps for missing samples, and weekday/date labels.
  On narrow screens allow keyboard-accessible scrolling inside the chart only.
- Add Go tests beside the source and extend `frontend/e2e/public-activity.spec.ts`.

## Verification

Cover early, equal-deadline and late completion; zero deadline; missing samples;
skipped/live recurrence; original snapshot due time; timezone/DST boundaries;
multiple pages; failed refresh; shared cache with no refresh before one hour
and refresh at expiry; unchanged upstream calls; anonymous
response privacy; mobile/desktop chart and skeleton geometry.

Run only inside the matching already-running Dev Container:

```sh
docker exec -w /workspaces/vikunja-better-ui <container> \
  go test ./internal/service ./internal/vikunja -run 'Activity|PublicActivity' -race -count=1
docker exec -w /workspaces/vikunja-better-ui <container> task gen:check
docker exec -w /workspaces/vikunja-better-ui <container> task validate
docker exec -w /workspaces/vikunja-better-ui <container> task test
docker exec -w /workspaces/vikunja-better-ui <container> task e2e
```

Follow the repository's existing strict Go/TypeScript limits and generated UI
rules. Review, simplify, and re-review after implementation. Do not commit,
push, release, add dependencies, or change recurrence semantics in this scope.

## Review and resource evidence

- New Go tests failed before implementation for early/equal/late completions,
  snapshot deadlines and the one-hour TTL. Reversing the final deadline
  comparison also fails early, late and history regression cases; restored
  the correct comparison before final checks.
- Real local HTTP integration: 10,000 records, 30 simultaneous readers, exactly
  101 requests with 100-record pages, or 201 with a 50-record instance cap.
  Subsequent readers before expiry add zero requests. At one hour, concurrent
  readers trigger exactly one additional complete scan.
- Synthetic reducer: 100,000 records, exactly 1,001 client calls; another
  1,000 cache reads add none. A 1,001-page upstream is rejected at 1,000 pages,
  without publishing partial counts.
- Simplification replaced per-task date formatting and fourteen string
  comparisons with a DST-safe calendar-day index. Year and DST regressions pass.
  It removes per-task string allocations without retaining task data.

Local Linux/arm64 benchmarks, three 500ms samples, same synthetic fixture before
and after the day-bucketing simplification (approximate medians):

| Workload | Before | After |
| --- | --- | --- |
| 10,000-record reducer | 1.18 ms, 10,121 allocations | 0.85 ms, 120 allocations |
| 100,000-record reducer | 11.81 ms, 101,026 allocations | 7.90 ms, 1,025 allocations |
| Aggregate value | 680 bytes | 680 bytes |
| Cache hit | 48 ns, 0 allocations | 48 ns, 0 allocations |

The aggregate gains 224 bytes relative to the old count-only structure. These
are reducer/cache measurements, not production network latency or total process
RAM. About 9.5 MB allocated over a complete 100,000-record synthetic scan is
cumulative allocation, not a retained task cache or a measured peak heap.
Upstream JSON and decoding still have transient costs; response limits and one
page at a time remain in force. Real upstream latency may hit the unchanged
20-second deadline on a very large window; incomplete results are never shown
as complete. Per-process caches do not coalesce across replicas.

Review retained fixed page size 100 rather than enlarging full rich-task JSON
responses toward the response-size ceiling. The new metric does not add
per-task, per-day or per-priority requests, dependencies, filters or persistence.
Browser verification uses the repository's isolated Playwright fixture because
Chrome DevTools MCP is unavailable. Physical iOS acceptance remains separate.

Final checks after the last implementation edit: focused Go/HTTP tests with
race detection, `task gen:check`, `task validate`, and `task test` passed;
frontend 294/294, full `task e2e` 454/454 (8.8 minutes). The existing WebKit
timezone scenario still logs its stylesheet CSP warning while passing; no
security policy or test assertion was weakened. These are local results, not
GitHub CI or production verification.
