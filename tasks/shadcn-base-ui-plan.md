# Implementation Plan: shadcn Base UI migration

## Overview

Reinitialize the existing Vite frontend with shadcn Base UI, replace all
handwritten UI primitives through the official CLI, migrate consumers without
editing generated source, add delayed background refresh Toast feedback, and
remove the legacy implementation only after all consumers are verified.

## Architecture decisions

- Pin Base UI explicitly in `components.json`; do not rely on a CLI default.
- Preserve the existing Zen theme through semantic CSS variables outside
  generated component files.
- Use the registry's current APIs even when that requires consumer changes.
- Keep generated source vendor-like and put product policy in wrappers or
  feature modules.
- Distinguish initial query state from background network state. Cached content
  is the stable surface; Toast is transient background feedback.
- Apply other library migrations only when official docs identify a relevant
  migration for an API used in this frontend.

## Dependency graph

```text
inventory + baseline tests
  -> Base UI init and registry configuration
    -> generated primitives
      -> shared wrappers and consumer migration
        -> legacy removal
          -> delayed task feedback
            -> docs, generated bundle, and full verification
```

## Phases

### Phase 1: Foundation

1. Record behavior and dependency inventory, including generated-file
   boundaries and relevant official migrations.
2. Reinitialize shadcn with explicit Base UI configuration and preserve the
   application theme contract.
3. Install only the required components with the official `add` command and
   verify their registry provenance.

The generated Calendar is excluded until its upstream strict-TypeScript
incompatibility is resolved. The approved exception is a feature-owned
`@daypicker/react` v10 adapter composed with generated Dialog, Popover, and
Button primitives.

Checkpoint: shadcn `info` reports Base UI, frontend typecheck/build pass, and
the theme renders in both system color schemes.

### Phase 2: Consumer migration

4. Migrate simple primitives: Button, Badge, Card, Field, Input, and Textarea.
5. Migrate composed controls: Select, Calendar, Pagination, and responsive date
   selection through current component APIs or external wrappers.
6. Remove every legacy implementation and obsolete helper after repository-wide
   reference checks prove zero consumers.

Checkpoint: focused component tests, typecheck, and responsive form/task flows
pass without direct edits under `components/ui` after CLI generation.

### Phase 3: Stable background feedback

7. Add Toast and its application-level Toaster through the CLI.
8. Test and implement a feature-owned delayed task refresh notifier: no toast
   before one second, one loading toast afterward, close on success, replace
   with an error toast on failure, and retain cached rows throughout.
9. Keep page-level initial loading/error behavior and migrate any background
   metadata error that would otherwise move an already-rendered list.

Checkpoint: deterministic unit tests and Playwright network-delay/error checks
pass with no task-list layout shift.

### Phase 4: Governance and release gates

10. Update `AGENTS.md`, README, and the UI spec with CLI-only installation,
    generated-file ownership, wrapper rules, and refresh/error behavior.
11. Regenerate embedded assets and run all final repository, dependency,
    browser, responsive, theme, and accessibility gates.
12. Review the final diff for correctness, simplicity, architecture, security,
    performance, dead code, and reproducible registry output.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Re-init overwrites theme or product behavior | High | Inventory first; keep theme and policy outside generated files; compare browser states |
| Base UI APIs differ from native controls | High | Migrate one control family at a time with focused tests and keyboard checks |
| Generated files drift after customization | High | Prohibit direct edits; regenerate via CLI and keep wrappers external |
| Refresh Toast flickers | Medium | Deterministic one-second delay and cleanup tests |
| Background error hides cached content | High | Separate initial state from background status; assert rows remain visible |
| Unrelated library migration expands scope | Medium | Require official migration guidance and an existing affected API |

## Open questions

None.
