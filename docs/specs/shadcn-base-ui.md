# Spec: shadcn Base UI foundation

Status: Accepted on 2026-08-21.

## Objective

Replace the handwritten shadcn-like frontend primitives with the current
shadcn registry generated for Base UI. Keep the application responsive,
accessible, system-theme aware, and visually consistent while making future
component updates reproducible through the shadcn CLI.

The migration also replaces in-flow background task refresh messages with the
current shadcn Base UI Toast. Cached task rows remain stable during a refresh.
A loading toast appears only after one second; a background refresh failure is
reported by toast without removing cached data. Initial loading and initial
failure remain page-level states.

The date picker uses `@daypicker/react` v10 through a feature-owned calendar
composition. The current shadcn Base UI Calendar registry output is excluded
because it fails this repository's strict TypeScript settings
(`exactOptionalPropertyTypes` and indexed-property access). Dialog, Popover,
and Button remain CLI-generated shadcn components. Reevaluate this narrow
exception when the upstream Calendar compiles unchanged.

Base UI runs under `CSPProvider` with a unique nonce generated for every HTTP
response and passed through the HTML. CSP restricts inline style elements to
that nonce, allows Base UI's runtime positioning attributes through
`style-src-attr 'unsafe-inline'`, and includes the equivalent `style-src`
fallback for tested WebKit versions. Scripts remain self-only.

## Capability map

| Module | Responsibility | Depends on |
| --- | --- | --- |
| `shadcn-foundation` | Base UI registry configuration, dependencies, theme integration | — |
| `ui-primitives` | CLI-generated components used by the app | `shadcn-foundation` |
| `ui-consumers` | Application composition through generated props or project wrappers | `ui-primitives` |
| `task-feedback` | Delayed background refresh and error Toast behavior | `ui-consumers` |
| `ui-governance` | Contributor and agent rules for generated components | `shadcn-foundation` |
| `verification` | Unit, E2E, accessibility, responsive, and build gates | all modules |

Build order:

```text
shadcn-foundation -> ui-primitives -> ui-consumers -> task-feedback
                  -> ui-governance ----------------> verification
```

## Tech stack

- React 19, strict TypeScript 7, Vite 8, and Tailwind CSS 4.
- shadcn CLI current release at installation time with `base: "base"`.
- Base UI through dependencies selected and pinned by the shadcn CLI.
- Existing Apollo Client 4 query and cache behavior.
- Vitest and Playwright with axe-core for verification.

Other existing frontend libraries may be migrated only when their official
documentation provides a relevant migration for code already used by this
application. Do not add unused components or migrate unrelated product code.

## Commands

Run inside the existing Dev Container from `frontend/`:

```text
pnpm dlx shadcn@latest init --base base --template vite --reinstall
pnpm dlx shadcn@latest add <component>
pnpm dlx shadcn@latest info
pnpm dlx shadcn@latest docs <component> --base base
```

Repository verification remains:

```text
task gen
task gen:check
task fix
task validate
task test
task e2e
```

## Project structure

```text
frontend/components.json          shadcn CLI configuration
frontend/src/components/ui/       CLI-generated components; never hand-edit
frontend/src/components/          project wrappers and shared composition
frontend/src/features/            feature-owned composition and behavior
frontend/src/styles/              project theme tokens and global policy
frontend/src/main.tsx             application-level Toaster mount
```

## Code style

Generated UI components are consumed directly when their API fits. Product
defaults that cannot be expressed by props or theme tokens belong in a wrapper
outside `components/ui`:

```tsx
import { Button } from "@/components/ui/button";

export function CompactAction(props: React.ComponentProps<typeof Button>) {
  return <Button size="sm" {...props} />;
}
```

Do not fork a generated component to preserve an obsolete prop name. Migrate
the consumer to the current API or introduce a focused wrapper used by more
than one consumer.

## Testing strategy

- Unit tests cover the one-second boundary, fast refresh, slow refresh,
  successful completion, background failure, and cleanup on unmount.
- Existing component tests are migrated to current generated APIs rather than
  testing registry internals.
- Playwright verifies stable task-list geometry, loading/error toast behavior,
  keyboard interaction, system light/dark themes, and 320, 768, 1024, and
  1440-pixel viewports.
- `task gen:check`, `task validate`, `task test`, and `task e2e` run after the
  final edit.

## Boundaries

### Always

- Initialize with Base UI explicitly and commit `components.json` and the
  resulting lockfile.
- Install or refresh UI components only with
  `pnpm dlx shadcn@latest add <component>` inside `frontend/`.
- Treat `frontend/src/components/ui/*` as CLI-generated source.
- Customize with component props, project CSS tokens, or wrappers outside the
  generated directory.
- Keep only components used by the application.
- Preserve system-selected light/dark appearance and accessible interaction.
- Allow deletion of an unreferenced generated component; reintroduce it only
  through the CLI, never by copying registry source.

### Ask first

- Add a UI package not selected by the shadcn CLI or required by an approved
  existing-library migration.
- Change the product theme, interaction semantics, or supported browsers.

### Never

- Hand-edit, patch, or mechanically rewrite files under
  `frontend/src/components/ui/`.
- Copy component source from documentation or registry responses.
- Keep a handwritten legacy primitive beside its generated replacement.
- Install the full shadcn registry or unused demo components.
- Replace stable cached task content with a refresh message or error panel.

## Success criteria

- `components.json` identifies Base UI and all installed UI components match
  the current Base UI registry output.
- Every active consumer uses the generated component API or an external
  wrapper; no legacy primitive or stale import remains.
- The project rules make the CLI-only generated-file boundary explicit.
- A task refresh completing within one second produces no toast or layout
  movement.
- A slower refresh shows one loading toast without moving the list and closes
  it when the request settles.
- A background refresh error becomes an error toast while cached rows remain;
  an initial error remains in the page.
- Full repository and browser checks pass with no accessibility regression.

## Open questions

None.
