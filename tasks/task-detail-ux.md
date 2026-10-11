# Task detail UX

Improve the existing task page, not recurrence or data semantics. User approved
implementation first and will evaluate the result in preview.

## Design contract

Use the supplied Linear issue screens and [Linear's inline-property pattern](https://linear.app/docs/project-overview)
as references for hierarchy, not a visual clone. Keep our tokens, Base UI, rich
content, explicit saves and server-confirmed actions.

- Main action: complete the task/occurrence in one click; retain existing Undo rules.
- Readable title and description, visible editing affordances, selectable body text.
- Properties grouped into task context and schedule. Side column from desktop;
  on phones keep content first, no horizontal scrolling, usable touch targets.
- Keep Edit and Skip discoverable; move diagnostic/destructive actions into a
  keyboard-accessible more menu. Separate Discussion page remains accessible.
- Explain that recurring discussion belongs to the series and history is read-only.
- Preserve independent fresh loading, uncertain-save protection and HTML fidelity.

## Work and acceptance

- [x] Test primary completion, Undo, menu focus/navigation and responsive hierarchy first.
- [x] Implement actions, content affordances and grouped properties in focused modules.
- [x] Match skeleton structure; check empty/rich/long/completed/recurring states.
- [x] Review and simplify; run focused E2E, gen:check, validate, test and full E2E.
- [x] Start isolated preview on 4180 for human evaluation; do not commit or publish.

## Verification: 2026-10-11

Focused E2E: 55 passed across 320px Chromium/WebKit, 768px, 1024px and 1440px.
Tests include keyboard/menu accessibility, rich content, conflict/uncertain-save
drafts, completion/Undo and held Skip versus Complete. The latter failed before
the shared action-lock fix. Axe found no violations in the tested task pages.
Generation, strict validation and the race-enabled Go/frontend test suite passed.
Full E2E: 447/448 passed; the pre-existing local ARM Chromium video playback
renderer crash remains at task-discussion-media.spec.ts:241. No test was skipped
or weakened. This is not a claim that the full suite is green.

Preview uses an isolated fixture, not production. Its task page was inspected in
Chromium with no page errors. Implementation is ready for the requested human UX
evaluation; no commit, push or release was performed.
