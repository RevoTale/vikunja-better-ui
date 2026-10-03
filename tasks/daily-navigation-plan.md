# Daily navigation and loading

Approved scope: 2026-10-01. Continue without separate phase approvals; no commit,
push, dependency additions or container lifecycle changes are authorized.

## Contract and build order

1. Defaults: Today is the root/login fallback, brand target and PWA start URL.
   Explicit deep links remain intact. Week never scrolls automatically; Today
   explicitly returns to the current week and scrolls to its day heading.
2. Long term: replace the No date navigation label. Preserve UNSCHEDULED API
   behavior; add LONG_TERM for active tasks with no deadline or a due instant
   strictly after now plus seven calendar days in Vikunja's timezone. Present
   dated and undated tasks separately, retain project/ordinary-label filters.
3. Daily navigation: Today retains overdue/current tasks and pagination.
   Date-selected days use the server calendar projection engine, not browser
   recurrence calculations. Future days assume prior scheduled cycles complete;
   completion-relative recurrence remains uncomputed as in Week. No writes.
4. Performance: measure production JS and request dependencies first. Keep only
   measurable improvements; no stale server cache or permission bypass.

Existing Week, list and PWA components supply the visual contract. Keep small
outline Previous/Today/Next controls, responsive wrapping, reserved loading
space and clearly secondary Computed rows. No generated UI edits.

## Checklist

- [x] Defaults and explicit-only week scrolling; route/PWA/browser regressions.
- [x] LONG_TERM filtering, boundaries and grouping; Go and browser coverage.
- [x] Bounded single-day calendar query with label/project validation; DST,
  recurrence, inaccessible input and empty/partial-result coverage.
- [x] Daily navigation preserving filters, date-prefilled creation and computed
  read-only behavior; frontend and mobile/desktop E2E.
- [x] Measure JS and GraphQL, implement justified optimizations and record results.
- [x] Update user docs and current plan index without overwriting historical work.
- [x] Review -> fix -> simplify -> re-review.
- [x] After final code edits: task gen:check, task validate, task test, task e2e.

Run all commands with docker exec in the matching existing container at
/workspaces/vikunja-better-ui. Focused Go tests use go test; frontend tests use
pnpm --dir frontend test; full commands are the Taskfile entrypoints above.
Tests live beside source and in frontend/e2e. Generated contracts use task gen.
Preserve strict file/function limits, typed schema, auth, CSRF and fresh data.

## Risks

- DST: use local calendar-day arithmetic, never an assumed 24-hour day.
- Projections: share Week's rules, limits and source identity; no synthetic task IDs.
- Navigation races: do not present a previous date's response under a new heading.
- Existing PWA installations may retain an old OS launch URL until metadata updates.

## Measurements

Production Vite build, summed emitted JS chunks (not first-page transfer):

| Build | Raw KB | Gzip KB | Chunks |
| --- | ---: | ---: | ---: |
| Before daily-navigation changes | 1911.21 | 578.20 | 70 |
| With new views and lean list selections | 1919.25 | 580.73 | 72 |
| Trial: documentNodeImportFragments | 1919.25 | 580.73 | 72 |
| Final, including click-time navigation | 1919.37 | 580.82 | 72 |

The codegen trial produced identical output and was removed. Keep existing
route/editor/emoji lazy chunks; do not introduce manual vendor splitting without
a demonstrated improvement. Added features cost approximately 2.62 KB gzip
across all chunks; this is not a claim of a smaller bundle or faster production
TTFB. The entry chunk changed from 303.20/97.72 KB raw/gzip to 303.06/97.66 KB.

TaskList and calendar selections no longer request full descriptions, which
their cards do not display. Full descriptions remain in details/edit operations.
Day uses the parent Session result rather than mounting another observer after
timezone arrives. E2E verifies one fresh metadata request on day navigation:
the route auth check invalidates the partial Session cache. Retaining this
refresh avoids replacing freshness with an incidental cache optimization.

Backend inspection confirmed in-flight user/project/label coalescing, bounded
parallel pagination, no per-task fetch for list rows and no new TTL cache.
Timezone and selected-project authorization remain necessary dependencies.

Review fixed an explicit-current-date timezone race. Regression tests hold
Session and Day responses independently. Projection expansion now stops at
10,000 and returns an empty incomplete result rather than a truncated schedule.
Day navigation computes the current local date at click time, including when a
tab stays open across midnight. Pure regressions include Kyiv's DST transition.
Long term's native browser test isolates tasks with an ordinary label so shared
fixture growth cannot move its assertions onto a later page.

Research references: [Apollo fetch policies](https://www.apollographql.com/docs/react/data/queries),
[non-normalized cache fields](https://www.apollographql.com/docs/react/caching/cache-field-behavior),
and [Vite async chunk loading](https://vite.dev/guide/features.html#async-chunk-loading-optimization).
Runtime tests and the installed toolchain, rather than these general docs alone,
determine the results above.

## Final verification — 2026-10-01

- Focused Go service/resolver regressions and frontend day/route tests passed.
- Final focused daily browser checks: 12 passed across phone Chromium, phone
  WebKit and desktop Chromium. Earlier PWA safe-area focused checks also passed.
- `task gen:check`: passed; generated contracts are reproducible.
- `task validate`: passed with unchanged strict Go/Biome/TypeScript gates.
- `task test`: passed, including Go `-race -count=2 -shuffle=on` and 283 frontend
  tests across 48 files.
- `task e2e`: 381 passed in 7.5 minutes against isolated Vikunja 2.5.0.
  Chromium used the existing 156.0.8075.0 executable override; WebKit used its
  bundled runtime. The previously documented stylesheet CSP warning remains in
  the passing timezone WebKit scenario; it is not a new test failure.
- Desktop day and 320px Long term screenshots inspected: controls fit, computed
  rows remain secondary, and Later/No deadline groups are distinct.
- Independent review, fixes, simplification and re-review: no required findings.

Earlier full runs are not acceptance evidence: one exposed outdated default/
auto-scroll assertions, another exposed shared-fixture pagination in the new
Long term test. Those assertions/setup were corrected without removing coverage.
The final passing run covers the updated implementation and tests. No commit,
push, CI run, container lifecycle change or deployment was performed.
