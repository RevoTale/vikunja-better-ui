# Implementation Plan: Vikunja Better UI MVP

## Overview

Complete the accepted MVP as vertical, verifiable slices. The existing Go
GraphQL boundary and Vikunja v2 adapter are the foundation. Frontend slices
consume that contract, followed by the real Vikunja 2.5.0 browser harness and
delivery automation.

## Architecture decisions

- Keep the request path `React -> same-origin GraphQL -> Vikunja API v2`.
- Keep Vikunja 2.5.0 as the only supported upstream version.
- Use URL-owned navigation state, Apollo-owned server state, and no app data
  persistence.
- Use the accepted TweakCN theme through Tailwind 4 and shadcn source
  components with minimal custom CSS.
- Run every project command in the existing Dev Container.
- Do not commit during this Goal run.

## Dependency graph

```text
Pinned frontend toolchain and theme
  -> generated GraphQL documents and route tree
    -> authenticated application shell
      -> task lists and details
        -> creation and completion workflows
          -> real Vikunja Playwright harness
            -> CI, release, and production image
```

## Phases

### Phase 1: Frontend foundation

1. Pin the approved frontend dependencies and strict tooling.
2. Configure Vite static output, Tailwind 4, Biome, Vitest, GraphQL Codegen,
   and TanStack Router generation.
3. Import the accepted theme tokens and add the responsive application shell.
4. Implement the session query, login, logout, route restoration, and Apollo
   lifecycle.

Checkpoint: frontend generation, lint, typecheck, unit tests, production build,
and Go embedding all pass.

### Phase 2: Product workflows

5. Implement URL-validated Today, week, month, jobs, unscheduled, and history
   task lists with project filtering and paging.
6. Implement task details and the read-only Extended diagnostics page.
7. Implement one-time, recurring, and job creation pages.
8. Implement completion, recurring repair, and bounded Undo feedback.

Checkpoint: every route and mutation works against GraphQL with loading, empty,
error, partial, and success states at phone, tablet, and desktop widths.

### Phase 3: Real integration and delivery

9. Add the pinned, checksummed Vikunja 2.5.0 binary harness with isolated
   SQLite state and deterministic fixtures.
10. Add Playwright flows that assert visible UI and direct Vikunja v2 state,
    including accessibility and responsive behavior.
11. Add the non-root multi-stage production image and smoke check.
12. Add reusable CI, release-please, and gated multi-architecture GHCR release
    workflows with immutable action SHAs.

Checkpoint: `task gen:check`, `task validate`, `task test`, `task e2e`, and the
production image smoke test pass from the Dev Container.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Vikunja v2 runtime differs from OpenAPI | High | Pin 2.5.0 and assert runtime behavior in the harness |
| Recurring completion partially succeeds | High | Preserve deterministic snapshot reconciliation and explicit repair state |
| Generated code drifts | Medium | Commit generated outputs and gate them with `task gen:check` |
| Mobile controls become inconsistent | Medium | Compose shared shadcn primitives and test fixed viewports |
| CI release bypasses tests | High | Make release and image jobs depend on the reusable full check workflow |

## Open questions

None. The accepted specification and Goal provide the required product choices.
