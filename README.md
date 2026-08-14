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

Use a dedicated Vikunja token with the smallest practical permissions. The app
needs to read projects and tasks, create/update tasks, and read/create labels
and task-label relations. It also needs task deletion so an active task or
recurring series can be removed from the task detail page. Do not reuse the app
login credentials for Vikunja.

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
task dev        # run the application
```

`task e2e` downloads the official Vikunja 2.5.0 binary for Linux amd64 or
arm64, verifies its pinned SHA-256 digest and detached signature, and runs it
directly with an isolated SQLite directory. Every run creates deterministic
fixtures and a short-lived scoped token, then removes its temporary data.

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
