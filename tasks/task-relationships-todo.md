# Task relationships implementation checklist

Status 2026-10-01: all implementation slices are complete, including automatic
content linking with approved `golang.org/x/net/html`, the approved shared Lexical
description editor and Unicode emoji. Full verification is recorded below.
The namespaced Job marker is complete. Product decisions and boundaries are in
[the plan](task-relationships-plan.md). Generated outputs are regenerated with
their schema/operation changes and are not counted as hand-edited task scope.
Do not commit or push without an explicit request.

## 1. Verify the pinned relation contract

- [x] Inspect pinned 2.5.0 API methods, shapes, permissions and trusted task URL
  paths; record inverse, duplicate, cycle/multiple-parent and pagination behavior.
- [x] Verify parent deletion and recurring completion leave independent children
  intact; document any mismatch with the intended product contract.
- [x] Decide bounded relation summaries, additive payloads and retry design.

Verification: isolated fixture integration checks, including inaccessible targets
and duplicate relation writes. Dependencies: none. Scope: S; Vikunja integration
tests and a short contract note in the plan.

## 2. Rename backend Job marker

- [x] Create/classify/edit Jobs with `vbu:job` only; legacy `job` has no Job effect.
- [x] Ordinary-label policy reserves `vbu:*`, not `job`; preserve explicit Job
  creation and completion/history behavior.
- [x] Add positive/new-marker and negative/legacy-marker regression cases.

Verification: focused Go service tests for creation, edit, classification and
recurring/history Jobs. Dependencies: none. Scope: M; task-kind/label policy and
their tests; split additional affected fixture groups into focused follow-ups.

## 3. Finish marker contract across UI and rollout docs

- [x] Hide/reserve all `vbu:*` labels consistently in picker and display; allow
  ordinary `job`. Do not rename form variants or GraphQL enums.
- [x] Update affected fixtures and current README/label documentation.

Excluded by the user: migration, inventory/relabel/rollback tooling and upstream
data changes. Legacy `job` remains ordinary metadata.

Verification: frontend policy tests, marker E2E and focused backend fixtures.
Dependencies: 2. Scope: M; picker/display policy, tests and rollout documentation;
split fixture updates if the hand-edited file count exceeds five.

### Checkpoint A

- [x] Old/new marker cases pass; migration is explicitly excluded.
- [x] Pinned API evidence supports the next slices; `task validate` passes.

## 4. Expose native related-task operations

- [x] Implement typed bounded relation reads/add/remove with access checks,
  duplicate reconciliation and safe errors.
- [x] Add additive GraphQL operations and regenerate clients.
- [x] Keep workflow code in services and preserve existing mutation contracts.

Verification: transport, service and resolver tests for symmetric add/remove,
duplicate/uncertain writes and forbidden targets. Dependencies: 1. Scope: two M
steps: transport + service first, schema + thin resolvers next.

## 5. Ship manual related-task UI

- [x] Show independently loaded Related tasks with title/ID search and navigation.
- [x] Add/remove relations and refresh both cached sides; confirm removal.
- [x] Preserve input during loads/errors and paginate search results.

Verification: component tests and desktop/mobile keyboard E2E against the fixture.
Dependencies: 4. Scope: M; relation section, search, operations and tests.

## 6. Ship existing-task parent/child relationships

- [x] Show direct children, completion count and parent navigation.
- [x] Attach/detach existing tasks without copying properties or deleting tasks.
- [x] Prevent self/cycle/second-parent writes and surface external conflicts.

Verification: service graph tests and E2E attach/navigate/detach, denied access,
externally conflicting parents and independent completion. Dependencies: 4, 5.
Scope: two M steps: parent workflow/contract tests, then section/actions/E2E.

### Checkpoint B

- [x] Both sides reflect relations after reload and after mutations.
- [x] Permission failures leak no inaccessible task details; validation passes.

## 7. Ship quick child creation

- [x] Copy project/priority/ordinary labels once; exclude Job, recurrence, dates
  and all `vbu:*` markers. Copy defaults once; subsequent user edits win.
- [x] Create then attach with explicit partial success; retain created task ID
  and retry attachment only. Never automatically repost uncertain creation.
- [x] Keep the parent visible, offer the next child, and preserve failed drafts.

Verification: service partial-failure tests, user-input precedence tests, repeated
creation E2E including a recurring Job parent. Dependencies: 2, 3, 6. Scope: three
M steps: creation workflow, form context, inline composer and integration tests.

## 8. Implement trusted task-reference extraction

- [x] Resolve trusted public frontend URLs and supported task paths to IDs.
- [x] Parse HTML/text; exclude quoted replies, code and metadata; deduplicate,
  bound targets and compare references before/after edits.
- [x] Validate targets through configured Vikunja transport, never pasted URLs.

Verification: table-driven parser tests for both UI URLs, fragments, prefixes,
malformed/foreign URLs, self-links, duplicates and excess references.
Dependencies: 1, 4. Scope: M; parser, trust configuration and tests.

## 9. Connect automatic linking to confirmed saves

- [x] Hook task create/description edit and comment create/edit through services.
- [x] Return saved content plus typed link warnings; repair only failed relations
  from persisted content. Keep mutation compatibility.
- [x] Do not unlink on content deletion, rescan history snapshots, or restore
  deliberately removed relations on unrelated text edits.

Verification: service/resolver failure tests and E2E for each save path, repeated
saves, partial success and repair without duplicate comments/tasks.
Dependencies: 4, 8. Scope: separate M steps for comment saves and task saves,
each including GraphQL/UI feedback and tests; then shared repair integration.

### Checkpoint C

- [x] Creation and content survive relation failures without duplicate retries.
- [x] Recurring parent/child behavior remains independent; full safe tests pass.

## 10. Ship Unicode emoji insertion

- [x] Choose a maintained accessible picker/dataset approach; document and obtain
  approval before adding a dependency if needed.
- [x] Add shared picker/shortcode insertion without rewriting URLs/code or
  unrecognized shortcodes; retain cursor, undo and draft behavior.
- [x] Confirm Unicode/HTML round trips in descriptions and comments, including
  joined emoji and skin tones.

Verification: editor unit tests plus keyboard/mobile and save/reload E2E.
Dependencies: dependency decision only; coordinate shared editor changes with 9.
Scope: two M steps: editor insertion/data, then picker UI and E2E.

## 11. Release verification and documentation

Review cycle: independent reviewer found rejection-state draft locking and
child-side detach using parent permissions. Both were fixed, regression tests
added, and independently re-reviewed with no remaining required findings in
those fixes.
The final editor review also caught an inaccessible loading placeholder. It now
has an adjacent screen-reader status. Mobile toolbar height and Lexical anchor
landmarks were fixed without weakening assertions; focused E2E passed 21/21.
The automatic-linking review then fixed relative-link preservation, ordinary
blockquote extraction, relationship refresh after saves, confirmed-description
fallback and separation of repair success from refresh failure. Simplification
and independent re-review found no remaining required fixes. Focused description
and reference-link E2E passed 12/12 on desktop Chromium and phone WebKit.
The full suite then exposed an empty Lexical typeahead anchor in the accessibility
tree, failing four existing closed-listbox assertions. The public anchor class
now hides only an empty menu; populated suggestions are unchanged. Added initial
and post-selection accessibility assertions; independent re-review found no
required changes. The failed run (365 passed, four failed) is retained as diagnostic
evidence, not completion evidence.

- [x] Update README and relevant current docs to the final behavior; clearly
  separate tested fixture behavior from production state. No migration scope.
- [x] Run `task gen:check`, `task validate`, `task test`, `task e2e` after final
  implementation edits inside the existing Dev Container.
- [x] Review changes against this plan and record unresolved constraints.

Remaining acceptance is manual: physical mobile keyboard/iOS installation and
production-instance verification. No production data has been migrated.

Final local verification (2026-10-01, after the last implementation edit):
`task gen:check`, `task validate` (zero lint issues), `task test` (Go race/shuffle
twice and 277 frontend tests) and `task e2e` (369 passed, 7.7 minutes).
The focused typeahead regression passed 6/6 before the full run. Chromium used
the approved 156.0.8075.0 override; WebKit was bundled. The previously documented
Today stylesheet CSP warning remains in the passing timezone WebKit scenario.
No CI run, production deployment or physical-device acceptance is claimed.

Dependencies: all prior implementation items. Scope: S documentation plus full
verification. No production relabeling, deployment, commit or push implied.
