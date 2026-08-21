# shadcn Base UI migration checklist

## Task 1: Inventory and baseline

- [x] Record every UI primitive, consumer, custom prop, CSS token, and official
  migration relevant to the current frontend.
- [x] Add behavior-first tests that protect existing form, date, pagination,
  theme, and task-list states.
- [x] Verify the focused baseline tests inside the Dev Container.

## Task 2: Initialize the Base UI foundation

- [x] Run shadcn init with explicit Base UI and Vite options.
- [x] Produce a reproducible `components.json` and CLI-selected pinned
  dependencies while preserving system light/dark theme tokens.
- [x] Confirm `pnpm dlx shadcn@latest info` reports the intended base.

## Task 3: Generate required primitives

- [x] Install Button, Badge, Card, Field, Input, Textarea, Select, Calendar,
  Pagination, Toast, and any required responsive overlay through
  `pnpm dlx shadcn@latest add` only.
- [x] Do not manually modify generated files after installation.
- [x] Keep the documented Calendar exception limited to the feature-owned
  `@daypicker/react` v10 adapter; no copied registry Calendar remains.
- [x] Run typecheck/build before consumer migration expands.

## Task 4: Migrate simple consumers

- [x] Replace obsolete Button size/variant props with current generated APIs.
- [x] Migrate Badge, Card, Field, Input, and Textarea consumers.
- [x] Pass focused component and form tests.

## Task 5: Migrate composed controls

- [x] Migrate Select consumers to the Base UI composition without losing form
  submission, labels, validation, or keyboard behavior.
- [x] Migrate Calendar, Pagination, and responsive date selection through
  generated APIs and external wrappers where product policy is required.
- [x] Pass phone, tablet, desktop, keyboard, and accessibility checks.

## Checkpoint: Remove legacy UI

- [x] Repository-wide search finds no old primitive import, prop, helper, or
  direct generated-file customization.
- [x] Delete legacy files only after all active consumers use replacements.
- [x] Frontend lint, typecheck, unit tests, and build pass.

## Task 6: Add stable task refresh feedback

- [x] A refresh under one second shows no toast.
- [x] A slower refresh shows one loading toast without moving cached rows and
  closes it on success.
- [x] A background failure becomes an error toast while cached rows remain.
- [x] Initial loading and initial failure remain page-level states.

## Task 7: Document governance and behavior

- [x] `AGENTS.md` requires CLI-only installation/refresh and prohibits direct
  edits under `frontend/src/components/ui/`.
- [x] README documents Base UI ownership and refresh/error behavior.
- [x] Spec and task checklist match the implemented state.

## Final checkpoint

- [x] `task gen:check`
- [x] `task validate`
- [x] `task test`
- [x] `task e2e`
- [x] Dependency audit and Docker image smoke pass.
- [x] Final five-axis review has no unresolved required findings.
