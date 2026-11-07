# Upstream API audit

2026-11-07. Request: group reads where useful and reduce Vikunja API calls
without changing business logic. Scope is the current working tree, including
planning and reminders. No production traffic or task data was modified.

## Call-path inventory

| Path | Current behavior / conclusion |
| --- | --- |
| Session | `/user` only when `vikunjaUser` is selected; app auth itself is local. |
| Projects / labels | Paginated catalogue reads; concurrent identical reads share an in-flight operation. No TTL. Projects also needs user default-project settings. |
| Today / Active / period / recurring / jobs lists | User and projects overlap; labels only when required by scope/filter. Project validation precedes filtered queries. First task page determines remaining pages; at most four page requests run together. |
| List comment counts | Requested with task pages, no request per card. Active total uses the existing result. |
| Today badge | One filtered task-page metadata read, `per_page=1`; no project/user/label reads. Separate freshness lifecycle is intentional. |
| Week / day | Bounded task-page loading and local recurrence projection; no read per projected occurrence. |
| History | Upstream pagination rather than fetching all historical tasks. |
| Details / diagnostics | User + projects overlap, then task read. Independently requested details, diagnostics and relationships can read the same task more than once; no global task cache added. |
| Reuse values | User settings, labels, then paginated newest-task search; local classification may scan all matching history. Each page is bounded, not the total scan. |
| Discussion | One requested comment page; original quoted comment reads are explicit, not per-list-card enrichment. |
| Attachments / avatar | Explicit metadata/content reads. Streaming preserves access checks and bounded memory; do not merge binary data into task queries. |
| Relationships / candidates | Native relations include related titles; no hydration per related card. Candidate search is paginated. Hierarchy walks are bounded and check real ancestors. |
| Create / edit / completion / repair | Reads around writes validate permissions, canonical labels, versions and outcomes. Retain confirmation reads and uncertain-write reconciliation. |
| Automatic reference links | Up to 20 targets, serial writes within a five-second budget. Each target is revalidated; batching these mutations would change partial-failure/concurrency behavior. |
| Authenticated activity | Fresh bounded aggregates with in-flight sharing; separate from public snapshots. All-time history can remain expensive. |
| Public activity | Existing fixed aggregate cache only, under ADR-008. No authenticated task data cache introduced. |
| Transport | One reusable HTTP client, pooled connections, bounded timeouts, safe timing logs. |

## Changes and evidence

Deterministic service call-count tests failed on the previous implementation:

- Create with three existing markers: **3 Labels calls → 1**. Task creation,
  attachment order and confirmation stay the same. If Labels spans multiple
  pages, each eliminated catalogue read also eliminates its page requests.
- Add a child to a root parent: **3 relation reads → 2**. Including the two
  unchanged task validations and relation write: **6 upstream calls → 5**.
  The parent was previously read twice before the write.

Tests also verify canonical selection after label creation, fresh reads in the
next resolution phase, cycles/second-parent rejection and write reconciliation.
These are request-count measurements, not production latency claims.

## Deliberate limits

- Active/planning lists may need the full bounded candidate set to classify,
  sort and count correctly before local pagination. Replacing this with the
  visible 30 rows would change results. Narrow project/label/date filters are
  already pushed upstream where their semantics allow.
- Separate GraphQL operations may repeat metadata after the earlier in-flight
  read completes. Combining every screen request would couple independent
  loading/error states; it is not automatically fewer upstream calls.
- Reusing task reads across a mutation is unsafe without an explicit boundary.
  Do not remove checks merely because their endpoint matches an earlier read.
- No API/schema changes, dependencies, database or migration. Reverting these
  two local changes restores the old request counts without data migration.

## Verification

- Focused race tests passed for service, Vikunja client and GraphQL resolvers.
- `task validate` and `task test` passed after the final code/test changes.
  This includes Go race/shuffle suites and 374 frontend tests.
- Independent review found no blockers. Added its suggested regression:
  failed catalogue refresh after marker creation prevents task creation.
- The original implementation failed both call-count regressions; the new
  implementation passes with unchanged result and write-count assertions.
- No production latency benchmark or real-server load test. Preview was not
  restarted; these backend changes are verified in the Dev Container.

### Review and simplify loop — 2026-11-07

- Re-reviewed only these API optimizations. Added indirect ancestor-cycle and
  uncertain-write readback regressions; both keep the reduced read counts.
- Temporarily disabled ancestor reads: the new cycle test failed because a
  forbidden write occurred. Restored the source before final verification.
- Simplification review found no useful production refactor. The local lookup
  and explicit pre-write/post-write boundary remain clearer than more abstraction.
- Final independent review found no remaining issues and independently ran the
  focused regressions in the project Dev Container.
- Final service/client/resolver race tests, `task validate`, and `task test`
  passed (374 frontend tests plus Go suites). Business behavior is unchanged.
