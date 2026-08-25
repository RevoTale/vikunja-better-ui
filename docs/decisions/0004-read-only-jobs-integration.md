# ADR-004: Accept request-scoped Vikunja tokens for read-only Jobs

## Status

Accepted.

## Date

2026-08-16.

## Context

Server-side dashboards such as Glance need the same active Jobs projection as
the browser client and may also need Jobs completed within a reporting
interval. Calling Vikunja directly would duplicate Better UI's exact `job`
marker, classification, sorting, timezone, pagination, and optional label
filter behavior. Reusing the browser GraphQL endpoint would require dashboard
clients to manage an expiring cookie session and would place read and mutation
operations behind the same machine credential.

The dashboard may already hold a dedicated, read-only Vikunja API token. The
application must remain stateless and must not become an arbitrary upstream
proxy.

## Decision

Expose `GET /integrations/v1/jobs` as a purpose-built JSON endpoint. The caller
provides a Vikunja API token through the `Authorization: Bearer` header. The
server creates a request-scoped Vikunja client for the configured
`APP_VIKUNJA_URL`, reuses the existing Jobs workflow, returns display-only
fields, and releases the client's idle connections after the request.

The endpoint defaults to active Jobs. `status=completed` requires caller-
supplied absolute RFC 3339 lower and upper completion boundaries and applies a
half-open interval to Vikunja's authoritative `done_at`. Better UI does not
infer the caller's week, timezone, or daylight-saving boundaries. Completed
results sort by completion time descending and then ID descending. Every item
uses the same response shape with nullable `doneAt`.

The endpoint accepts only bounded pagination values and one optional exact,
case-sensitive label title. It resolves label titles to numeric Vikunja IDs
before applying the filter. Both active and completed requests keep Job-marker,
non-recurring-task, permission, optional-label, and pre-pagination filtering
semantics. It exposes no mutation, caller-selected upstream URL, browser cookie
authentication, or CORS exception. Tokens are never persisted, returned, or
logged, and responses are not cacheable by shared or private HTTP caches.

## Alternatives considered

### Call Vikunja directly from Glance

Rejected as the primary integration because it duplicates Better UI's Jobs
semantics in dashboard configuration and can drift when classification or
ordering changes.

### Add bearer authentication to the existing GraphQL schema

Rejected because the schema includes mutations. Correctly restricting a
machine token to an operation allowlist would add more authorization surface
than a single read-only resource needs.

### Give Glance the configured application token

Rejected because `APP_VIKUNJA_API_TOKEN` has write permissions required by the
interactive application. A dashboard should use its own minimum-permission
token.

## Consequences

- Glance can consume the canonical Jobs projection with a standard custom API
  widget.
- Existing requests remain active by default; completed reporting is opt-in and
  uses the same read-only token permissions.
- Results are limited by the projects and permissions of the caller's Vikunja
  token.
- The Go server temporarily handles another secret but never stores it.
- The integration is deliberately limited to Jobs. Adding other views or
  mutations requires a separate contract and security review.
- Browser authentication and GraphQL behavior remain unchanged.
