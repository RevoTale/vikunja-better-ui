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

- Shows overdue and due-today tasks first, with optional week, month, and
  project filters.
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

The app is stateless. It uses a signed, expiring, HTTP-only session cookie and
stores tasks, recurrence metadata, and history only in Vikunja. The exact
recurring-history design is documented in
[ADR-001](docs/decisions/0001-recurring-history-snapshots.md).

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
| `tasks_labels` | `create`, `read_all` |

This is the minimum permission set exercised by the app's end-to-end tests.
Missing permissions can make login or task operations fail because the backend
validates the token by reading the current Vikunja user immediately after app
authentication. Store the generated token value as `APP_VIKUNJA_API_TOKEN`.
Do not use the app username or password to authenticate with Vikunja.

## Development

Open the repository in its Dev Container first. The container installs pinned
Go, Node.js, pnpm, Task, Playwright, and Docker access. Rebuild the Dev Container
after changing `.devcontainer/devcontainer.json`.

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
