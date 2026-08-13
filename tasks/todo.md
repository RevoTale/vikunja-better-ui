# Vikunja Better UI MVP checklist

## Frontend foundation

- [x] Pin approved stable dependencies and `pnpm-lock.yaml`.
  - Acceptance: no beta/RC packages; package manager and runtime versions are pinned.
  - Verify: frozen install succeeds.
- [x] Configure strict TypeScript, Biome, Vite, Tailwind 4, Vitest, route generation, and GraphQL Codegen.
  - Acceptance: generated documents and route tree are reproducible.
  - Verify: frontend generation, lint, typecheck, tests, and build pass.
- [x] Add exact TweakCN light/dark tokens and reusable shadcn primitives.
  - Acceptance: semantic controls share sizes, colors, focus, and disabled states.
  - Verify: visual check at 320, 768, 1024, and 1440 pixels.
- [x] Implement Apollo, session login/logout, protected routing, and `returnTo`.
  - Acceptance: cookies are same-origin; logout clears Apollo state; reload restores route state.
  - Verify: focused unit tests and browser login/logout flow.

## Product workflows

- [x] Implement project-aware Today/week/month lists.
- [x] Implement Jobs in both Today and Jobs views.
- [x] Implement Unscheduled grouped by collapsible project.
- [x] Implement the latest-30 History view and paging.
- [x] Implement task detail and Extended diagnostics pages.
- [x] Implement one-time creation.
- [x] Implement recurring creation with From completion as the default.
- [x] Implement job creation with duration and a default 60-minute completion window.
- [x] Implement one-click recurring completion without confirmation or Undo.
- [x] Implement one-time/job completion with bounded Undo.
- [x] Implement explicit repair states without duplicate creation or renewal.

Each workflow must preserve URL state, expose loading/empty/error/success states,
remain keyboard accessible, and pass focused tests before the next workflow.

## Integration and delivery

- [x] Add the direct Vikunja 2.5.0 Linux amd64/arm64 fixture metadata and verification.
- [x] Add the isolated SQLite E2E harness and deterministic API-token fixtures.
- [x] Add Playwright phone/tablet/desktop projects and axe checks.
- [x] Assert every required mutation against direct Vikunja v2 state.
- [x] Add reusable GitHub CI with generated drift, validation, all tests, E2E, and image smoke gates.
- [x] Add release-please manifest workflow gated by CI.
- [x] Add the pinned RevoTale multi-arch image release workflow gated by release and CI.
- [x] Add a non-root production image containing CA certificates and timezone data.
- [x] Update README and environment documentation for development, testing, and deployment.

## Completion audit

- [x] `task gen:check`
- [x] `task validate`
- [x] `task test`
- [x] `task e2e`
- [x] Production image smoke test
- [x] No browser-to-Vikunja request, API v1 product call, secret exposure, database, skipped test, or hand-edited generated file exists.
