# Task relationships implementation checklist

All items are pending. Product decisions and boundaries are in
[the plan](task-relationships-plan.md). Generated outputs are regenerated with
their schema/operation changes and are not counted as hand-edited task scope.
Do not commit or push without an explicit request.

## 1. Verify the pinned relation contract

- [ ] Inspect pinned 2.5.0 API methods, shapes, permissions and trusted task URL
  paths; record inverse, duplicate, cycle/multiple-parent and pagination behavior.
- [ ] Verify parent deletion and recurring completion leave independent children
  intact; document any mismatch with the intended product contract.
- [ ] Decide bounded relation summaries, additive payloads and retry design.

Verification: isolated fixture integration checks, including inaccessible targets
and duplicate relation writes. Dependencies: none. Scope: S; Vikunja integration
tests and a short contract note in the plan.

## 2. Rename backend Job marker

- [ ] Create/classify/edit Jobs with `vbu:job` only; legacy `job` has no Job effect.
- [ ] Ordinary-label policy reserves `vbu:*`, not `job`; preserve explicit Job
  creation and completion/history behavior.
- [ ] Add positive/new-marker and negative/legacy-marker regression cases.

Verification: focused Go service tests for creation, edit, classification and
recurring/history Jobs. Dependencies: none. Scope: M; task-kind/label policy and
their tests; split additional affected fixture groups into focused follow-ups.

## 3. Finish marker contract across UI and rollout docs

- [ ] Hide/reserve all `vbu:*` labels consistently in picker and display; allow
  ordinary `job`. Do not rename form variants or GraphQL enums.
- [ ] Update affected fixtures and current README/label documentation.
- [ ] Write inventory, collision handling, relabel and rollback instructions
  covering live/completed/history Jobs; do not execute upstream migration.

Verification: frontend policy tests, marker E2E and focused backend fixtures.
Dependencies: 2. Scope: M; picker/display policy, tests and rollout documentation;
split fixture updates if the hand-edited file count exceeds five.

### Checkpoint A

- [ ] Old/new marker cases pass; migration impact is explicit.
- [ ] Pinned API evidence supports the next slices; `task validate` passes.

## 4. Expose native related-task operations

- [ ] Implement typed bounded relation reads/add/remove with access checks,
  duplicate reconciliation and safe errors.
- [ ] Add additive GraphQL operations and regenerate clients.
- [ ] Keep workflow code in services and preserve existing mutation contracts.

Verification: transport, service and resolver tests for symmetric add/remove,
duplicate/uncertain writes and forbidden targets. Dependencies: 1. Scope: two M
steps: transport + service first, schema + thin resolvers next.

## 5. Ship manual related-task UI

- [ ] Show independently loaded Related tasks with title/ID search and navigation.
- [ ] Add/remove relations and refresh both cached sides; confirm removal.
- [ ] Preserve input during loads/errors and paginate search results.

Verification: component tests and desktop/mobile keyboard E2E against the fixture.
Dependencies: 4. Scope: M; relation section, search, operations and tests.

## 6. Ship existing-task parent/child relationships

- [ ] Show direct children, completion count and parent navigation.
- [ ] Attach/detach existing tasks without copying properties or deleting tasks.
- [ ] Prevent self/cycle/second-parent writes and surface external conflicts.

Verification: service graph tests and E2E attach/navigate/detach, denied access,
externally conflicting parents and independent completion. Dependencies: 4, 5.
Scope: two M steps: parent workflow/contract tests, then section/actions/E2E.

### Checkpoint B

- [ ] Both sides reflect relations after reload and after mutations.
- [ ] Permission failures leak no inaccessible task details; validation passes.

## 7. Ship quick child creation

- [ ] Copy project/priority/ordinary labels once; exclude Job, recurrence, dates
  and all `vbu:*` markers. Parent context overrides last-task autofill.
- [ ] Create then attach with explicit partial success; retain created task ID
  and retry attachment only. Never automatically repost uncertain creation.
- [ ] Keep the parent visible, offer the next child, and preserve failed drafts.

Verification: service partial-failure tests, autofill precedence tests, repeated
creation E2E including a recurring Job parent. Dependencies: 2, 3, 6. Scope: three
M steps: creation workflow, form context, inline composer and integration tests.

## 8. Implement trusted task-reference extraction

- [ ] Resolve trusted public frontend URLs and supported task paths to IDs.
- [ ] Parse HTML/text; exclude quoted replies, code and metadata; deduplicate,
  bound targets and compare references before/after edits.
- [ ] Validate targets through configured Vikunja transport, never pasted URLs.

Verification: table-driven parser tests for both UI URLs, fragments, prefixes,
malformed/foreign URLs, self-links, duplicates and excess references.
Dependencies: 1, 4. Scope: M; parser, trust configuration and tests.

## 9. Connect automatic linking to confirmed saves

- [ ] Hook task create/description edit and comment create/edit through services.
- [ ] Return saved content plus typed link warnings; repair only failed relations
  from persisted content. Keep mutation compatibility.
- [ ] Do not unlink on content deletion, rescan history snapshots, or restore
  deliberately removed relations on unrelated text edits.

Verification: service/resolver failure tests and E2E for each save path, repeated
saves, partial success and repair without duplicate comments/tasks.
Dependencies: 4, 8. Scope: separate M steps for comment saves and task saves,
each including GraphQL/UI feedback and tests; then shared repair integration.

### Checkpoint C

- [ ] Creation and content survive relation failures without duplicate retries.
- [ ] Recurring parent/child behavior remains independent; full safe tests pass.

## 10. Ship Unicode emoji insertion

- [ ] Choose a maintained accessible picker/dataset approach; document and obtain
  approval before adding a dependency if needed.
- [ ] Add shared picker/shortcode insertion without rewriting URLs/code or
  unrecognized shortcodes; retain cursor, undo and draft behavior.
- [ ] Confirm Unicode/HTML round trips in descriptions and comments, including
  joined emoji and skin tones.

Verification: editor unit tests plus keyboard/mobile and save/reload E2E.
Dependencies: dependency decision only; coordinate shared editor changes with 9.
Scope: two M steps: editor insertion/data, then picker UI and E2E.

## 11. Release verification and documentation

- [ ] Update README and relevant current docs to the final behavior and migration
  instructions; clearly separate tested fixture behavior from production state.
- [ ] Run `task gen:check`, `task validate`, `task test`, `task e2e` after final
  implementation edits inside the existing Dev Container.
- [ ] Review changes against this plan and record unresolved constraints.

Dependencies: all prior implementation items. Scope: S documentation plus full
verification. No production relabeling, deployment, commit or push implied.
