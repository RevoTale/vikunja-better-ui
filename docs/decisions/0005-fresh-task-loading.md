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
