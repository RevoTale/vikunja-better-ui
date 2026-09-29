# ADR-005: Keep task loading fresh and overlap independent reads

## Status

Accepted

## Date

2026-08-21

## Context

Production task lists can spend hundreds of milliseconds waiting for Vikunja.
The Go service itself is fast, but the list workflow needs user settings,
projects, sometimes labels, and one or more task pages. Serializing independent
reads adds their network latency. A normal TTL cache would improve repeat
latency but could temporarily hide a completion, a new occurrence, or an
external Vikunja edit.

The UI should remain responsive without claiming stale data is fresh, and the
backend should remain stateless and simple.

## Decision

- Do not cache task or metadata results across completed requests in Go.
- Start independent user, project, and label reads concurrently.
- Start unfiltered task loading once its actual prerequisites are ready instead
  of waiting for projects used only to map the response.
- Read active-task page 1 first, then load the remaining known pages with a
  concurrency limit of four. Assemble and validate them in page order and never
  return a partial successful list.
- Coalesce identical user, project, and label reads only while the upstream call
  is in flight. One canceled caller does not interrupt remaining waiters, while
  the final departing caller cancels the upstream request. A later caller
  always performs a fresh read.
- Let Apollo display normalized cached rows immediately, but require a network
  refresh for task-list views. Show refreshing and failed-refresh states.
- Measure upstream calls by coarse resource and duration without logging URLs,
  query parameters, IDs, content, or credentials.

## Loading presentation policy

Added 2026-09-28. This is the preferred direction for future UI changes, not
confirmation that every existing loading state implements it.

- Prioritize initial page loading and independently loaded components. Render
  the static shell immediately and reserve space for delayed content such as
  timezone, avatars, and counts.
- Prefer layout-matched skeletons for predictable content regions over briefly
  flashing “Loading…” text. Keep related fields together; let independent
  sections load and fail without hiding already available content.
- Never show “No tasks”, a zero count, or a fabricated default while the value
  is unknown. Show an empty state only after a successful empty response.
- Avoid repeated placeholder/content replacement and artificial minimum waits.
  Respect reduced-motion preferences. Loading and error feedback must remain
  accessible without moving surrounding controls.
- Preserve mandatory fresh reads. A placeholder, transition, or cache must not
  delay fetching or make previously fetched data look verified as current.
  Retained data is only a temporary display during revalidation, not a freshness
  guarantee; a failed read must remain explicit.
- Ask the user when choosing a loading treatment involves an unresolved UX
  tradeoff. Do not introduce another timing or indicator convention silently.

### Implemented loading treatments

- Reserve the timezone line before the session arrives. Show an inline skeleton
  while pending and “Timezone unavailable” when no value can be loaded.
- Use content-shaped placeholders for the initial task list, task details,
  discussion context, comments, and lazy editor. No artificial wait is added.
- Task-list placeholders use the same card padding, schedule column, and action
  size as loaded rows, with three badge placeholders per row. Titles and badges
  may wrap to two lines or grow further for longer content; never clip text to
  force an exact skeleton height. Responsive regression tests compare row width,
  position, and height, allowing one extra title line and badge row in the
  controlled two-line fixture.
- Place the comment count at the left of the metadata row, with flexible space
  before the right-aligned badges. On narrow screens the badge group wraps beside
  the count. Keep the count separate from the semantic list of task labels.
- Comment counts arrive with task data, not through per-task requests. Initial
  task placeholders include a short inline count placeholder. During a fresh
  list read, existing positive counts become inline skeletons; unresolved
  counts use the same treatment. Known zero counts remain hidden. Null counts
  after loading are unavailable, not permanently loading.
- Keep the discussion composer mounted during comment reads. Retain the last
  successful comment page while sorting, paging, or refreshing. Show “Updating
  comments…” in reserved space and expose `aria-busy` on the comments region.
  The page label describes the displayed response, not the pending page.
  If loading fails, explicitly identify retained comments as the previous
  successful result. Refresh remains available for retry.
- Use placeholders for quoted authors, original-comment reads, and attachment
  loading. Never substitute a different comment's content as a loading fallback.
- Respect reduced motion: placeholder pulsing and status opacity transitions
  apply only when motion is permitted.

The existing one-second delay for the manual refresh spinner and task-list
toast remains. Discussion freshness is indicated immediately without replacing
the comments or editor. No TTL cache, extra per-task request, artificial minimum
loading duration, or delayed network request is introduced.

Skeletons approximate unknown content; they cannot guarantee identical height
for arbitrary comment bodies. This does not promise zero layout movement when
the actual data changes.

Implementation uses Apollo's existing query results and `previousData`, not a
second application cache. See [Apollo query results](https://www.apollographql.com/docs/react/data/queries)
and [React Suspense fallbacks](https://react.dev/reference/react/Suspense).

### Verification expected when implementing

Use controlled response timing in browser E2E tests on mobile and desktop:

- Measure layout positions before, during, and after delayed content arrives.
- Observe loader visibility and transitions, including fast and slow responses.
- Assert that unresolved data never passes through misleading empty states.
- Delay independent sections separately and verify that available content stays
  usable. Cover failures and retries as well as success.
- Verify that a fresh request still occurs; retained content must not suppress it.

DOM visibility and geometry checks detect specific regressions, not every
perceptual flash. Supplement them with browser recordings or visual inspection.

## Alternatives considered

### Backend TTL or stale-while-revalidate cache

This lowers repeat latency but creates a period where completed or externally
edited tasks appear current. Rejected because freshness is part of the product
workflow and cache invalidation would add state and mutation coupling.

### Fully serial Vikunja requests

This is straightforward but makes independent network delays cumulative.
Rejected because bounded concurrency is small, testable, and materially shortens
the critical path.

### Start every request immediately

Some views need the user timezone, label IDs, or project validation to construct
the correct task query. Rejected because speculative calls would be incorrect or
wasteful.

## Consequences

- A typical Today list uses one user, one projects, and one tasks request; Jobs
  adds labels. Those calls overlap where their dependencies allow.
- Lists larger than one Vikunja page use more calls, but at most four remaining
  pages are active concurrently.
- Repeated navigation still reaches Vikunja, so freshness does not depend on a
  TTL. Apollo improves perceived speed while visibly refreshing.
- Slow upstream resources are identifiable from logs without exposing user data
  or secrets.
