# Vikunja Better UI

A focused Vikunja client for the workflows I actually use.

The main problem this solves is recurring tasks. Completing one should renew it
predictably without making me repeat Vikunja's full setup flow. The app also
keeps Today, Jobs, tasks without deadlines, and recent history close at hand.
It is deliberately not another general project-management system.

## AI-made only

This repository is made only through AI agents.

I define the product direction, constraints, and accepted decisions. AI agents
write the code, tests, and documentation. This is intentional and applies to
the whole repository.

## What it does

- Shows overdue and due-today tasks first, with week, month, and project
  filters.
- Presents Week as a responsive day-row ledger with read-only scheduled-cycle
  projections and honest completion-based recurrence explanations.
- Keeps jobs in both Today and their own view.
- Groups tasks without deadlines by collapsible project.
- Creates one-time tasks, recurring tasks, and duration-based jobs with small
  forms.
- Defaults recurring tasks to renew from completion, while also supporting a
  scheduled cycle.
- Completes recurring tasks in one click and keeps a Vikunja-backed history
  snapshot.
- Gives one-time tasks and jobs a short Undo window.
- Shows the latest 30 completed tasks initially, with URL-backed paging.
- Exposes a read-only Extended page for useful raw Vikunja fields.
- Works across phone, tablet, and desktop and follows the system light or dark
  color scheme with the configured TweakCN theme.

Only Vikunja 2.5.0 and its REST API v2 are supported.

## Recurring renewal behavior

Timed recurring tasks that renew **From completion date** default
**Keep due time** to enabled. The completion date controls the next calendar
date, while the task keeps its configured local deadline.

For a task due at 20:00 every two days:

| Renewal configuration | Completed | Next due |
| --- | --- | --- |
| From completion date; Keep due time on | Sunday 10:00 | Tuesday 20:00 |
| From completion date; Keep due time on | Sunday 21:00 | Tuesday 20:00 |
| From completion date; Keep due time off | Sunday 21:00 | Tuesday 21:00 |
| Scheduled cycle; current due Monday 20:00 | Tuesday 10:00 | Wednesday 20:00 |

Turning **Keep due time** off retains strict elapsed recurrence: two days means
exactly 48 hours. Scheduled cycle remains anchored to the existing schedule.
Complete and Skip use the same calculation. Date-only tasks do not show this
option.

See the [Keep due time specification](docs/specs/keep-due-time.md) for marker,
timezone, daylight-saving, validation, repair, and History behavior.

The Week view combines real tasks with clearly marked, non-actionable computed
scheduled cycles. It never assigns an estimated day to From completion
recurrence. See the [weekly ledger specification](docs/specs/weekly-ledger.md)
for navigation, projection, responsive-layout, and GraphQL behavior.

## Architecture and security boundaries

```text
React UI -> same-origin Go GraphQL API -> Vikunja REST API v2
```

The Go server embeds the static Vite build. The browser talks only to the
GraphQL endpoint and never receives or calls Vikunja with its API token.

Authentication has two separate boundaries:

1. A person signs in to this app with `APP_AUTH_USERNAME` and
   `APP_AUTH_PASSWORD`.
2. The Go backend accesses Vikunja with `APP_VIKUNJA_API_TOKEN`.

A separate read-only integration endpoint accepts a caller-provided Vikunja
API token for server-to-server dashboards. It never exposes browser mutations
or replaces the app session boundary. See
[ADR-004](docs/decisions/0004-read-only-jobs-integration.md).

The app is stateless. It uses a signed, expiring, HTTP-only session cookie and
stores tasks, recurrence metadata, and history only in Vikunja. The exact
recurring-history design is documented in
[ADR-001](docs/decisions/0001-recurring-history-snapshots.md).

Task lists keep Apollo-cached rows visible only while performing a mandatory
fresh read. The backend overlaps independent Vikunja calls, coalesces duplicate
metadata reads only while they are in flight, and does not retain a TTL cache.
Background refreshes that finish within one second stay silent. A slower
refresh uses a fixed toast, so task rows do not move; it closes on success and
becomes an error toast on failure while cached rows remain visible. Initial
loading and initial errors stay in the page because no cached list exists.
See [ADR-005](docs/decisions/0005-fresh-task-loading.md) and the
[performance guide](docs/performance.md) for the exact request graph,
benchmarks, and safe latency logs.

## Configuration

Copy `.env.example` to a local, ignored `.env` file and replace every example
secret.

| Variable | Required | Meaning |
| --- | --- | --- |
| `APP_VIKUNJA_URL` | Yes | Absolute Vikunja base URL. HTTPS is required in production. |
| `APP_VIKUNJA_API_TOKEN` | Yes | Vikunja token used only by the Go backend. |
| `APP_AUTH_USERNAME` | Yes | Username accepted by this app. |
| `APP_AUTH_PASSWORD` | Yes | Password accepted by this app. |
| `APP_SESSION_SECRET` | Yes | Base64 value decoding to at least 32 random bytes. |
| `APP_HTTP_ADDR` | No | Listen address; defaults to `:8080`. |
| `APP_LOG_LEVEL` | No | `debug`, `info`, `warn`, or `error`; defaults to `info`. |
| `APP_ENV` | No | `development`, `test`, or `production`; defaults to `production`. |
| `APP_ALLOWED_ORIGIN` | Production/test | Exact public app origin used for CSRF checks. Development defaults to `http://localhost:5173`. |

Use a dedicated Vikunja API token with these permissions:

| Permission group | Actions |
| --- | --- |
| `other` | `user` |
| `projects` | `read_all` |
| `tasks` | `create`, `read_all`, `read_one`, `update`, `delete` |
| `labels` | `create`, `read_all` |
| `tasks_labels` | `create`, `read_all`, `delete` |

This is the minimum permission set exercised by the app's end-to-end tests.
Missing permissions can make login or task operations fail because the backend
validates the token by reading the current Vikunja user immediately after app
authentication. Store the generated token value as `APP_VIKUNJA_API_TOKEN`.
Do not use the app username or password to authenticate with Vikunja.

## Read-only Jobs integration

`GET /integrations/v1/jobs` exposes the existing Jobs classification and
pagination behavior as JSON for Glance and similar server-to-server
dashboards. It accepts a dedicated Vikunja API token from the caller and uses
it only against the configured `APP_VIKUNJA_URL`. Requests return active Jobs
by default:

```http
GET /integrations/v1/jobs?label=dashboard&page=1&pageSize=30
Authorization: Bearer <Vikunja API token>
```

To request Jobs completed during a caller-defined interval, use a half-open
RFC 3339 range:

```http
GET /integrations/v1/jobs?status=completed&completedFrom=2026-08-24T00%3A00%3A00%2B03%3A00&completedBefore=2026-08-31T00%3A00%3A00%2B03%3A00&label=dashboard&pageSize=100
Authorization: Bearer <Vikunja API token>
```

`completedFrom` is inclusive and `completedBefore` is exclusive. Both are
required with `status=completed`. The caller supplies absolute timestamps, so
it owns week-start, timezone, and daylight-saving calculations. Completed Jobs
are ordered by `doneAt` newest first, then by task ID newest first. Supplying a
completion boundary for active status is invalid.

To build one chronological roster without merging JSON arrays in Glance, use
`status=all`. The completion range limits only the completed part; all active
Jobs remain eligible:

```http
GET /integrations/v1/jobs?status=all&completedFrom=2026-08-24T00%3A00%3A00%2B03%3A00&completedBefore=2026-08-31T00%3A00%3A00%2B03%3A00&sortBy=startAt&sortOrder=asc&label=dashboard&pageSize=100
Authorization: Bearer <Vikunja API token>
```

Both completion boundaries are required. `sortBy` accepts `startAt` and
`finishAt`; `sortOrder` accepts `asc` and `desc`. They default to `startAt` and
`asc` and are valid only with `status=all`. A Job's `finishAt` is its actual
`doneAt` after completion and its planned `dueAt` while active. Missing sort
timestamps always appear last, and task ID provides a stable tie-breaker. The
server loads active and completed Jobs concurrently, merges and sorts the full
bounded candidate set, and only then applies pagination.

The optional `label` parameter is an exact, case-sensitive label-title match.
When present, returned tasks must have both the `job` marker and the requested
label. An unknown label returns an empty page. `page` defaults to `1`, and
`pageSize` defaults to `30` with a maximum of `100`.

The caller token needs only these Vikunja permissions:

| Permission group | Actions |
| --- | --- |
| `other` | `user` |
| `projects` | `read_all` |
| `tasks` | `read_all` |
| `labels` | `read_all` |

Create a separate token for the dashboard. Pass it in the `Authorization`
header over HTTPS; never place it in a URL or commit it to configuration. The
endpoint does not store, return, log, or use the token for mutations. It also
does not use `APP_VIKUNJA_API_TOKEN`, so results reflect the projects and tasks
visible to the caller token.

Successful responses contain `items`, `page`, `pageSize`, `totalItems`,
`totalPages`, `hasMore`, `isComplete`, and `issues`. Each item contains its ID,
title, description, project, normalized priority, due/start/end timestamps,
`doneAt`, `finishAt`, labels, timezone, overdue state, and absolute Better UI
task URL. Timestamps are RFC 3339 values or `null`; `doneAt` is always `null`
for active Jobs. `finishAt` preserves `dueAt` as the active plan and switches
to `doneAt` as the completed fact. Priorities are `UNSET`, `LOW`, `MEDIUM`,
`HIGH`, `URGENT`, or `DO_NOW`.

### Glance custom API widget

Provide `VBU_URL` and `VIKUNJA_JOBS_TOKEN` to the Glance container through its
environment, then configure a custom API widget:

```yaml
- type: custom-api
  title: Jobs
  title-url: ${VBU_URL}/jobs
  cache: 5m
  url: ${VBU_URL}/integrations/v1/jobs
  headers:
    Authorization: Bearer ${VIKUNJA_JOBS_TOKEN}
    Accept: application/json
  parameters:
    label: dashboard
    pageSize: 100
  template: |
    <ul class="list list-gap-10">
      {{ range .JSON.Array "items" }}
        <li>
          <a href="{{ .String "url" }}">{{ .String "title" }}</a>
          <div class="size-h6 color-paragraph">{{ .String "project.title" }}</div>
        </li>
      {{ else }}
        <li>No matching jobs.</li>
      {{ end }}
    </ul>
```

Glance performs this request from its server, not from the dashboard browser.
Invalid or missing tokens return `401`; insufficient token permissions return
`403`; invalid parameters return `400`; oversized result sets return `422`;
and unavailable or invalid Vikunja responses return `502`.

For a completed-this-week widget, calculate absolute week boundaries in the
same timezone used by the dashboard and provide them to Glance, for example as
`VIKUNJA_JOBS_COMPLETED_FROM` and `VIKUNJA_JOBS_COMPLETED_BEFORE`:

```yaml
- type: custom-api
  title: Jobs completed this week
  cache: 5m
  url: ${VBU_URL}/integrations/v1/jobs
  headers:
    Authorization: Bearer ${VIKUNJA_JOBS_TOKEN}
    Accept: application/json
  parameters:
    status: completed
    completedFrom: ${VIKUNJA_JOBS_COMPLETED_FROM}
    completedBefore: ${VIKUNJA_JOBS_COMPLETED_BEFORE}
    label: dashboard
    pageSize: 100
  template: |
    <ul class="list list-gap-10">
      {{ range .JSON.Array "items" }}
        <li>
          <a href="{{ .String "url" }}">{{ .String "title" }}</a>
          <div class="size-h6 color-paragraph"
            {{ .String "doneAt" | parseTime "rfc3339" | toRelativeTime }}></div>
        </li>
      {{ else }}
        <li>No Jobs completed in this interval.</li>
      {{ end }}
    </ul>
```

Generate or refresh those values at the local week boundary. Better UI does
not infer a timezone from the dashboard request.

Use the same boundary variables with `status: all`, `sortBy: startAt`, and
`sortOrder: asc` when one Glance template should render active and completed
Jobs together. Change `sortBy` to `finishAt` when the roster should follow
planned or actual finish rather than scheduled start.

## Development

Open the repository in its Dev Container first. The container installs pinned
Go, Node.js, pnpm, Task, Playwright, and Docker access. Rebuild the Dev Container
after changing files under `.devcontainer/`.

Run all project commands inside that container:

```sh
task gen        # regenerate gqlgen, GraphQL operations, routes, and web assets
task gen:check  # prove committed generated output is current
task fix        # format Go and frontend files
task validate   # lint, typecheck, vet, and build
task test       # Go race tests and frontend unit tests
task e2e        # real browser tests against isolated Vikunja 2.5.0
task demo       # run the complete isolated demo at http://localhost:4180
task dev        # run the application
```

### Automated dependency updates

Renovate extends the RevoTale organization preset, which follows the official
`config:best-practices` preset. In particular, npm releases must be at least
three days old before Renovate creates a branch; pnpm independently rejects
packages newer than one day during every frozen install. The Dependency
Dashboard shows updates waiting for either policy. This repository uses only
Renovate's built-in Dockerfile, Dev Container, npm, and Go module managers.

Renovate groups runtime updates so Go, Node.js, and pnpm pins change together.
Go module updates run `go mod tidy`, npm updates deduplicate the pnpm lockfile,
and major upgrades stay in separate PRs labeled `breaking`. Renovate-hosted
does not run arbitrary repository generation commands, so CI still
intentionally requires generated GraphQL, route, and embedded asset output to
remain unchanged; a tool upgrade that changes generated output needs a
reviewed follow-up commit rather than bypassing `task gen:check`.

The production and development images copy pnpm from the official,
digest-pinned pnpm image. The frontend build runs on the separately pinned
Node.js image, while CI reads the exact Node.js version from
`frontend/package.json`. Task and golangci-lint are isolated as standard Go
tool dependencies in `tools/go.mod`; CI and the Dev Container install those
exact versions with `go install tool`. Gqlgen remains a tool of the application
module. No global npm, Corepack, custom Renovate manager, or version-check
script is required.

### Frontend components

The frontend uses the current shadcn Base UI registry. Files under
`frontend/src/components/ui` are generated vendor code: add or refresh a used
component only from `frontend/` with
`pnpm dlx shadcn@latest add <component>`. Do not edit those files directly;
apply product defaults through props, semantic theme tokens, or wrappers in
`frontend/src/components` and feature code.

The date picker currently composes `@daypicker/react` v10 in feature code with
generated Dialog, Popover, and Button components. This narrow exception avoids
an upstream shadcn Calendar strict-TypeScript incompatibility and should be
removed once the registry output compiles unchanged. See the
[Base UI migration specification](docs/specs/shadcn-base-ui.md).

Base UI is mounted with its CSP provider. The server generates a unique nonce
for every response and passes it through the HTML to Base UI's inline style
elements. Runtime style attributes used for popup positioning are allowed
separately; `style-src` includes that allowance as a WebKit fallback, while
`style-src-elem` remains nonce-restricted and `script-src` stays self-only.

`task e2e` downloads the official Vikunja 2.5.0 binary for Linux amd64 or
arm64, verifies its pinned SHA-256 digest and detached signature, and runs it
directly with an isolated SQLite directory. Every run creates deterministic
fixtures and a short-lived scoped token, then removes its temporary data.

### Preview the complete E2E app

Run this inside the Dev Container:

```sh
task demo
```

Open <http://localhost:4180> and sign in with:

```text
Username: app-user
Password: app-password-strong
```

The command builds the frontend and Go server, starts an isolated Vikunja 2.5.0
instance, creates deterministic fixtures and a scoped API token, and serves the
complete app. Stop it with `Ctrl-C`; its temporary database and files are then
removed.

The Dev Container forwards port `4180`. If VS Code assigns a different local
port, restart the demo with that forwarded address. For example, when VS Code
uses local port `4181`, run:

```sh
task demo DEMO_ORIGIN=http://localhost:4181
```

`DEMO_PORT` controls the container listener; `DEMO_ORIGIN` controls the browser
origin accepted by the server. To use port `4190` on both sides, run
`task demo DEMO_PORT=4190` and forward local port `4190`.

Running only the frontend development server is not a complete preview: GraphQL
requests to `/graphql` return 404 because the Go API is not present.

## Container image

Build and smoke-test the same non-root image used for releases:

```sh
task image:smoke
```

To run a built image, pass the variables above and publish port 8080:

```sh
docker run --rm -p 8080:8080 --env-file .env ghcr.io/revotale/vikunja-better-ui:latest
```

The runtime image contains CA certificates and timezone data and runs as a
non-root user.

The Go process uses about 10 MiB RSS while idle in the development fixture, but
peak memory depends on Vikunja task payloads and concurrent requests. In a
memory-limited container, set Go's `GOMEMLIMIT` 5–10% below the container limit;
for example, use `GOMEMLIMIT=115MiB` with a 128 MiB limit. Go 1.26 handles
cgroup CPU limits automatically. See [the performance budget](docs/performance.md)
for reproducible benchmarks, measured allocations, and tuning constraints.

## CI and releases

Pull requests and `main` run one reusable required-checks job covering generated
drift, validation, unit/integration tests, real Playwright E2E, and the
production image smoke test. Configure the GitHub branch rule for `main` to
require the `Required checks` status before merge.

After checks pass on `main`, release-please creates or updates the release pull
request. Merging that pull request creates the release, and the pinned RevoTale
action publishes `linux/amd64` and `linux/arm64` images to GHCR with the release
tag and `latest`.

See [AGENTS.md](AGENTS.md) for the repository rules and
[the MVP specification](docs/specs/mvp.md) for the complete product contract.
