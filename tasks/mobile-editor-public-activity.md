# Mobile editing and public activity

Approved scope: fix mobile task overflow and list markers; reduce list spacing;
keep discussion/subtasks out of recurring snapshots while preserving related
links; investigate creation fields being cleared; add opt-in public activity.

## Contracts

- Seven calendar days including today, in the token owner's Vikunja timezone.
- Count accessible completed tasks and stored completed recurrence snapshots.
  Skipped snapshots are not completed work; live renewed tasks are not counted.
- Public output contains dates, counts and priority totals only. No task names,
  IDs, descriptions, users, projects or configurable query filters.
- Disabled by default through `APP_PUBLIC_ACTIVITY_ENABLED=false`.
- Browser application data remains GraphQL. A single fixed aggregate is cached
  server-side for ten minutes; no retained task collections or persistence.
- Preserve mobile touch targets, multiline content, local table/code scrolling,
  loading geometry and existing recurrence renewal/repair semantics.
- No commits, dependency additions, or generated UI edits.

## Ordered verification slices

- [x] Reproduce editor markers/overflow in browser tests; demonstrate creation
      unmount with a regression test (the exact production typing sequence is unknown).
- [x] Fix demonstrated causes, test rich content and background refresh.
- [x] Compact rows and filter spacing with matched skeleton dimensions.
- [x] Test snapshot isolation, related links and idempotent repair.
- [x] Verify pinned Vikunja API, implement bounded aggregate and shared cache.
- [x] Add opt-in public GraphQL and responsive accessible charts; test privacy,
      disabled state, concurrent refresh, error cooldown and date boundaries.
- [x] Update product documentation and review/simplify/re-review.
- [x] Run focused checks then gen:check, validate, test and full real E2E.

Commands run only through `docker exec -w /workspaces/vikunja-better-ui
e7c5398a3609`: project tasks above, focused `go test`, Vitest and Playwright.
Physical iOS acceptance remains distinct from automated WebKit coverage.

## Evidence and limits

- Cold editor loads lacked the rich-text CSS; browser regression showed list
  markers computed as `none`. Styles now belong to editor/body components.
- A long project name expanded implicit grid tracks to 599px on a 320px
  viewport. Explicit zero-minimum columns and shrinkable Select values fixed it.
- The creation form used to unmount during settings refetch. Restoring that
  condition makes both new regression cases fail; preserving the form passes.
- Review caught shared-cache poisoning by the first visitor's cancellation.
  Refresh is now detached from that caller, with the same 20-second deadline.
- Charts use SVG and existing UI primitives; no new dependencies or persistence.
- [Pinned Vikunja collection implementation](https://github.com/go-vikunja/vikunja/blob/v2.5.0/pkg/routes/api/v2/task_collection.go)
  supports filtered pagination, not the requested daily/priority aggregate.
  The server reduces one page at a time and retains only one fixed aggregate.
- [Lexical lists](https://lexical.dev/docs/packages/lexical-list) require the
  corresponding presentation styles; a route-specific import is insufficient
  for shared editors reached through a direct URL.

Verification logs are local ignored files under `.cache/e2e/`. The final report
must distinguish focused passes from the complete final suite; early failed or
interrupted runs do not count as a full pass.
