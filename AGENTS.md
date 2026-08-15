# Project Rules

## Purpose

Build a small alternative client for Vikunja.

The main goal is to make recurring tasks quick and predictable. Remove repeated
setup and confusing flows from the standard Vikunja client. Build the workflows
needed by this project instead of copying every Vikunja feature.

Do not turn this project into a general project-management platform without an
explicit request.

## Architecture

Use this request path:

```text
React UI -> Go GraphQL API -> Vikunja REST API
```

The browser must never call Vikunja directly. The Go backend is the only code
allowed to use the Vikunja API token.

The app has two separate authentication boundaries:

1. A user logs in to this app with a username and password configured through
   environment variables.
2. The Go backend accesses Vikunja with an API token configured through an
   environment variable.

Do not use the app username and password to authenticate with Vikunja. Do not
support Vikunja username/password authentication.

Keep the app stateless. After app login, use a signed, expiring, HTTP-only
session cookie. Do not add a database for sessions or application data.

Use GraphQL for all browser application requests. Implement login and logout as
GraphQL mutations.

## Required stack

### Backend

- Go.
- `gqlgen` for GraphQL.
- Go `embed` for the built frontend.
- Stable `golangci-lint` with a checked-in strict configuration.
- The Go standard library unless a dependency clearly removes complexity.

### Frontend

- React with strict TypeScript. Enable strict compiler checks, including
  unchecked indexed access and exact optional property types.
- Vite with a static production build. Do not add server-side rendering.
- Node.js for frontend tooling.
- `pnpm` as the only package manager.
- Apollo Client for GraphQL requests and server state.
- GraphQL Code Generator for typed operations.
- Biome for formatting and linting with strict recommended rules enabled.

Pin pnpm with the `packageManager` field and commit `pnpm-lock.yaml`.

Do not replace required tools without explicit approval.

## Repository structure

Add directories only when code needs them. Use this layout:

```text
.
|-- AGENTS.md
|-- README.md
|-- Taskfile.yml
|-- go.mod
|-- go.sum
|-- gqlgen.yml
|-- .env.example
|-- cmd/
|   `-- server/
|       `-- main.go
|-- internal/
|   |-- auth/             # App login and signed sessions
|   |-- config/           # Environment parsing and validation
|   |-- graphql/
|   |   |-- generated/    # Generated gqlgen code; never edit by hand
|   |   |-- model/        # Generated and GraphQL-only models
|   |   |-- resolver/     # Thin resolvers
|   |   `-- schema/       # GraphQL schema files
|   |-- service/          # Application and recurring-task workflows
|   |-- vikunja/          # Vikunja HTTP client and API types
|   `-- web/              # Embedded frontend and SPA fallback
|-- frontend/
|   |-- index.html
|   |-- package.json
|   |-- pnpm-lock.yaml
|   |-- tsconfig.json
|   |-- vite.config.ts
|   `-- src/
|       |-- app/          # App shell, providers, and routes
|       |-- components/   # Shared presentation components
|       |-- features/     # Product features grouped by workflow
|       |-- graphql/      # Generated shared GraphQL types
|       |-- lib/          # Small shared helpers and Apollo setup
|       |-- styles/       # Global styles and design tokens
|       `-- main.tsx
`-- tests/
    `-- integration/      # Cross-package and HTTP integration tests
```

Keep unit tests beside their source. Use `tests/integration` only for tests that
cross package or HTTP boundaries.

## Backend rules

- Keep `cmd/server/main.go` limited to configuration and wiring.
- Parse and validate all environment variables in `internal/config`.
- Keep GraphQL resolvers thin. Put workflows in `internal/service`.
- Keep Vikunja request and response types in `internal/vikunja`.
- Define small interfaces beside the code that consumes them.
- Pass `context.Context` through every request path.
- Set HTTP client and server timeouts. Always close response bodies.
- Translate upstream errors into safe user-facing errors.
- Log useful causes without logging credentials, cookies, or request secrets.
- Use constant-time comparison for app credentials.
- Sign session cookies. Set `HttpOnly` and `SameSite`. Set `Secure` outside local
  development.
- Protect state-changing requests from cross-site request forgery.
- Format Go code with `gofmt`.
- Run `golangci-lint` with the repository configuration. Do not suppress a
  finding without a short, specific justification.
- Prefer short functions with one responsibility. Split files and functions
  when they combine unrelated workflows or become difficult to review; do not
  create arbitrary wrappers only to satisfy a line count.

Generated gqlgen code must be reproducible. Never make lasting manual edits to
generated files.

## GraphQL rules

- Treat the schema as the contract between frontend and backend.
- Use Vikunja domain names when they make the API clearer.
- Design mutations around user actions, especially recurring-task actions.
- Return enough data from mutations to update Apollo's cache.
- Use nullable fields only when absence has a real meaning.
- Do not use a generic JSON scalar for modeled application data.
- Keep named `.graphql` operation files beside their feature.
- Generate TypeScript operation types. Do not duplicate them by hand.

## Frontend rules

- Do not use `any` to bypass TypeScript errors. Use `unknown` and narrow it.
- Keep TypeScript strict. Do not weaken compiler or Biome rules to make a change
  pass.
- Group product code by feature, not only by technical type.
- Use Apollo Client for GraphQL server state.
- Use local React state only for short-lived view state.
- Keep components small, semantic, accessible, and keyboard-safe.
- Prefer small files and focused functions. Split components and helpers by
  responsibility before they become multi-workflow modules.
- Show loading, empty, error, and success states for remote workflows.
- Keep mobile and desktop layouts usable.
- Confirm destructive actions and name the affected resource, except task
  completion. Task completion follows the accepted one-click semantics:
  one-time tasks and jobs provide Undo, while recurring tasks have neither
  confirmation nor Undo.
- Do not expose secrets through Vite environment variables or the bundle.

## Recurring tasks

Recurring tasks are the main product feature.

- Keep a recurrence rule separate from one task occurrence.
- Clearly state whether an action changes one occurrence or the whole series.
- Use one documented completion rule.
- Do not silently create duplicate occurrences.
- Make retries safe where possible.
- Test date boundaries, time zones, overdue tasks, retries, and Vikunja partial
  failures.

## Configuration

Use the `APP_` prefix. The expected variables are:

- `APP_VIKUNJA_URL`: Vikunja base URL.
- `APP_VIKUNJA_API_TOKEN`: API token used only by the Go backend.
- `APP_AUTH_USERNAME`: username accepted by this app.
- `APP_AUTH_PASSWORD`: password accepted by this app.
- `APP_SESSION_SECRET`: strong secret used to sign session cookies.
- `APP_HTTP_ADDR`: HTTP listen address.
- `APP_LOG_LEVEL`: log level.

Document every variable in `.env.example` and `README.md`. Fail at startup with
a clear message when required configuration is missing or invalid.

Never commit a populated `.env` file or a real secret. Never put credentials in
the frontend bundle, GraphQL responses, URLs, logs, metrics, or user-visible
errors.

## Workflow

Use `Taskfile.yml` as the project workflow entrypoint. Run project commands in
the already-running Dev Container, never directly on the macOS host.

Provide these tasks when the related code exists:

```text
task gen       # Generate gqlgen and frontend GraphQL code
task gen:check # Verify generated files are current
task fix       # Format Go and frontend files
task validate  # Run non-mutating lint, typecheck, vet, and build checks
task test      # Run all safe tests
task demo      # Run the complete isolated E2E demo on port 4180
task dev       # Run the development application
```

After the final edit, run focused tests and then the applicable full checks.
Results from before the final edit do not count. Do not claim a check passed if
it was not run.

## Boundaries

Always:

- Read nearby code and instructions before editing.
- Keep changes small and tied to the request.
- Add focused tests for behavior changes.
- Update schema, generated code, tests, and documentation together.
- Explain why a new dependency is needed.
- Preserve unrelated user changes in a dirty worktree.

Ask first:

- Add or replace a dependency.
- Change the required stack or repository structure.
- Add persistence, another service, or another authentication method.
- Change recurring-task completion semantics.
- Change public GraphQL behavior in an incompatible way.

Never:

- Expose or log credentials, API tokens, session secrets, or cookies.
- Call Vikunja from browser code.
- Add server-side rendering.
- Add a database without approval.
- Edit generated files by hand.
- Remove tests to make checks pass.
- Mix unrelated cleanup into a requested change.
- Create a Git commit unless the user explicitly requests it.
