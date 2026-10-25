# ADR-008: Separate public activity snapshots from authenticated GraphQL

## Status

Accepted and implemented.

## Date

2026-10-25.

## Context

The activity and all-time activity pages have two different delivery needs.
Signed-in users need current, filterable, user-specific data. Anonymous readers
need one safe aggregate shared by every visitor. Serving both through GraphQL
POST responses marked `private, no-store` prevents reverse proxies and CDNs from
reusing the public aggregate. Making arbitrary GraphQL queries cacheable would
also allow query text and variables to multiply cache keys and origin work.

The application must retain the React/Vite frontend, authenticated GraphQL
features, stateless Go deployment, and server-only Vikunja token. Public traffic
must not make the all-history scan proportional to visitor count.

## Decision

Split activity delivery by trust boundary:

```text
Anonymous React page
  -> Go-rendered /activity or /all-time-activity HTML
  -> embedded initial public snapshot
  -> React progressive enhancement

React client navigation or refresh
  -> GET /public/v1/activity or /public/v1/all-time-activity
  -> shared HTTP cache
  -> bounded Go aggregate refresh
  -> Vikunja REST API

Authenticated React page
  -> GraphQL POST
  -> uncached Go workflow
  -> Vikunja REST API
```

GraphQL remains the only application API for authenticated reads, filters and
mutations. The public snapshot API is a narrow exception for anonymous activity
aggregates only. The browser never calls Vikunja directly.

### Public HTML and discoverability

Go renders indexable HTML for `/`, `/activity` and `/all-time-activity`; this is
not Node or React SSR. React progressively enhances the returned markup and
continues to own interactive charts, navigation and authenticated features.
Serve the same HTML to people and crawlers; never select a representation by
user agent.

The root page contains a concise product description and crawlable links to
activity pages that are publicly enabled. Public activity HTML contains its
heading, reporting period, totals and a semantic summary before JavaScript runs.
Embed the bounded initial snapshot so the first anonymous render does not make
another data request. All-time HTML includes the overall summary and current
13-week window rather than serializing the complete history into the document.
Client-side navigation and later refreshes use the public JSON resources.

The React `/` route preserves the landing page for anonymous visitors instead
of replacing it with an immediate `/login` redirect. It provides a clear sign-in
action. An authenticated browser may still redirect from `/` to `/today`, and
the installed PWA keeps `/today` as its start URL. This ensures that crawlers
which execute JavaScript see the same indexable root content rather than a login
screen.

Public HTML provides a server-rendered title, description, canonical URL, Open
Graph fields, Twitter Card fields and JSON-LD. The root explicitly describes a
local deployed `WebSite` and `WebApplication` instance, linked with `isBasedOn`
to the shared Better Vikunja `SoftwareApplication` and its `SoftwareSourceCode`.
Deployment entity IDs use the configured canonical origin; product and source
entity IDs use the GitHub repository, so multiple installations are not presented
as competing identities for one website. Enabled activity pages describe
a `Dataset` with their period, generation time and JSON distribution URL.
JSON-LD must describe content that is also visible on the page; do not publish
invented ratings or statistics.

Every public page has a compact footer stating that Better Vikunja is open-source
software and linking to `https://github.com/RevoTale/vikunja-better-ui`. Use the
existing icon library for the GitHub mark and keep a visible text label; the link
must remain usable without JavaScript. Root JSON-LD uses a separate
`SoftwareSourceCode` node for `codeRepository` and the MIT `license`, links it to
the shared `SoftwareApplication` with `targetProduct`, and describes the app as
free software. The deployed `WebApplication` references that shared product with
`isBasedOn`.
The software license is not a license grant for the personal activity dataset;
do not add a dataset license without an explicit data-publication decision.
`og:url` is always the canonical public page URL, not the GitHub repository. The
page also supplies a static social preview image; do not put activity values into
a URL or image filename.

Generate `/robots.txt` and `/sitemap.xml` from `APP_PUBLIC_URL` and the public
feature flags. Include the root only when `APP_PUBLIC_URL` is configured. Include
an activity page only when the public origin and its anonymous flag are both
enabled. Authenticated
application routes use `noindex, nofollow`; do not block those HTML routes in
`robots.txt`, because a crawler must read the response to observe `noindex`.
Use `robots.txt` only to reduce crawling of internal non-page resources. Public
JSON uses `X-Robots-Tag: noindex` while remaining crawlable as the dataset
distribution. `robots.txt` controls crawler traffic, not authorization or
index removal.

`APP_PUBLIC_URL` is the explicitly configured canonical origin and the opt-in
for indexing the root page. When absent, root remains accessible but returns
`noindex` and is omitted from the sitemap. When present, root returns
`index, follow`; activity flags independently decide whether their pages are
anonymous and indexable. Validate the value as an absolute HTTPS origin without
userinfo, path other than `/`, query or fragment. Local development may use an
explicit HTTP loopback origin. Do not derive canonical, sitemap, Open Graph or
JSON-LD URLs from an untrusted request `Host`.

### Public snapshot contract

Expose exactly these anonymous resources:

- `GET|HEAD /public/v1/activity`
- `GET|HEAD /public/v1/all-time-activity`

They return fixed, typed JSON aggregates. They accept no query parameters,
filter expressions, pagination, request bodies, cookies or bearer tokens.
Reject query strings instead of creating additional cache variants. Return
`405 Method Not Allowed` for methods other than GET and HEAD.

The React public-data client uses `credentials: "omit"`. The Go handlers ignore
session cookies and authorization even when a browser sends them unexpectedly.
Responses must never contain task IDs, titles, descriptions, users, project
names, label names, session-derived fields or other personalized data.

The two URLs are independent cache keys. Their representation must not vary by
cookie, authorization, user agent or language. Do not emit `Set-Cookie` or
`Vary: Cookie`.

### Cache policy

Successful responses use standard HTTP cache controls:

```http
Cache-Control: public, max-age=300, s-maxage=<seconds-until-refresh>, stale-while-revalidate=60
ETag: "<hash-of-exact-response>"
Last-Modified: <snapshot-generation-time>
Content-Type: application/json
X-Content-Type-Options: nosniff
```

The shared-cache lifetime is one hour from snapshot generation. Calculate
`s-maxage` from the remaining lifetime of the Go snapshot; never reset it to a
new hour when an existing origin snapshot is served. Otherwise the origin and
shared-cache TTLs can compound and expose data older than the documented limit.

Honor `If-None-Match` with `304 Not Modified`. Keep the existing bounded,
coalesced Go refresh behind the HTTP cache so simultaneous proxy misses do not
start duplicate Vikunja scans. Do not persist snapshots or task records.

Do not add `stale-if-error` initially. A failed refresh must not extend exposure
after permissions, tasks or public-access configuration change. A bounded
60-second `stale-while-revalidate` window may hide refresh latency while keeping
the maximum extension explicit.

When public access is disabled, the origin returns an uncacheable not-found
response. A snapshot already held by a shared cache can remain available until
its freshness lifetime ends. Operators requiring immediate removal must purge
both public URLs at the reverse proxy or CDN.

### Authenticated contract

Signed-in activity pages use authenticated GraphQL operations even when public
access is enabled. GraphQL responses stay `private, no-store` and may expose
approved priority, project and label filters. Do not route authenticated data
through a public endpoint or use a cookie-dependent representation at a public
URL.

The 14-day query is bounded and current. An authenticated all-time refresh can
remain expensive because Vikunja 2.7 has no aggregate group-by endpoint. Apply
upstream filters before pagination, keep existing page/time/response limits,
coalesce only identical in-flight work, and start the scan only from an explicit
page load or refresh. Do not present an older result as a confirmed fresh read.

### React and PWA integration

Keep one set of activity chart components. A small data adapter maps either the
public REST snapshot or authenticated GraphQL result into the same presentation
model. Anonymous routes use the public GET client; authenticated routes use
Apollo.

The anonymous server-rendered HTML and public JSON are separate representations
backed by the same Go snapshot. Cache them independently but give them the same
`generatedAt` and `refreshAt`. React consumes the embedded bounded snapshot on a
direct page load and does not immediately request the same JSON again. A later
SPA navigation or explicit refresh uses JSON. Authenticated React ignores the
public bootstrap for application state and reads current data through GraphQL.

Keep hashed Vite assets immutable. Public HTML may change with the hourly
snapshot; private SPA routes retain their current revalidated shell and CSP
boundary. Safely JSON-encode embedded bootstrap data and keep its response CSP
header consistent with the cached HTML body.

When anonymous activity is enabled, its HTML representation is public and must
not depend on a session cookie. A signed-in browser receives the same safe public
HTML and React replaces its data source with authenticated GraphQL after session
resolution. Keep the public snapshot visible and label it as updating until the
fresh authenticated result arrives; do not flash an empty chart or claim that
the cached snapshot is current. When anonymous activity is disabled, an anonymous request receives
an uncacheable 404 while an authenticated request may receive the private SPA
shell. Never mark that cookie-dependent branch public or let it reuse a previous
public cache entry after a flag change.

Render and cache the public HTML bytes, CSP header and ETag as one representation
for the snapshot lifetime. A per-request CSP nonce would otherwise change the
HTML and validator on every origin request. Embedded bootstrap data must be
non-executable and safely escaped, or carry the matching cached CSP nonce; never
relax CSP with `unsafe-inline` for this feature.

Do not precache public snapshots in the service worker. Online requests use the
browser and shared HTTP caches. Offline activity data requires a separately
approved, visibly stale snapshot policy; private GraphQL data remains excluded
from service-worker storage.

## Alternatives considered

### Keep public activity on GraphQL POST

Rejected because ordinary shared caches primarily reuse GET responses by URI.
The current `private, no-store` boundary is correct for authenticated GraphQL but
cannot offload anonymous traffic.

### Cache arbitrary GraphQL GET requests

Rejected because query text, aliases and variables expand the cache and abuse
surface. Persisted-query infrastructure would add complexity for two fixed
resources without improving the public contract.

### Return public or private data from one cookie-dependent URL

Rejected because it risks cache leakage and requires cookie-based cache
variation, which destroys the shared hit rate.

### Put the complete all-time aggregate only in HTML

Rejected because it makes documents grow with account history and wastes
bandwidth on every navigation. Public HTML and JSON contain the same bounded
13-week summary; complete history remains available only through authenticated
GraphQL.

## Consequences

- Anonymous traffic can be served by one shared representation for up to an
  hour without reaching Go or Vikunja. HTML and JSON have distinct cache keys
  but share one origin aggregate refresh.
- Authenticated views retain React, Apollo, filters, mutations and fresh-data
  semantics.
- Public and private cache keys cannot collide because they use different URLs
  and protocols.
- The reverse proxy or CDN must be configured to honor origin cache headers for
  the two JSON URLs. The `Age` header should be observable in production.
- Each application replica still has its own bounded Go aggregate cache, but a
  shared edge cache absorbs normal reader traffic and request bursts.
- Disabling public access is eventually effective within the cache lifetime
  unless the operator purges the public URLs.
- This ADR changes the documented browser boundary. It does not authorize other
  REST endpoints, public filters, SSR, arbitrary proxying or browser access to
  Vikunja.

## Verification

The implementation is covered by these required checks:

1. add handler, cache-header, ETag, method and query-rejection tests;
2. prove cookies and authorization cannot alter a public representation;
3. prove authenticated pages still select GraphQL and public pages omit credentials;
4. test public-disabled behavior and document proxy purge operations;
5. verify repeated requests through the production proxy produce cache hits and
   no additional Vikunja calls;
6. verify server-rendered HTML, canonical metadata, JSON-LD, Open Graph,
   `robots.txt`, sitemap and private-route `noindex` behavior;
7. verify the visible open-source footer and repository/license metadata;
8. test `APP_PUBLIC_URL` validation and prove its absence keeps root out of the
   index and sitemap;
9. keep `.env.example` and README operational text aligned with runtime behavior.
