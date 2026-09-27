# Task Discussion Implementation Checklist

Initial scope completed 2026-09-26. The approved editor/media extension below
is implemented and verified with the approved Chromium test-runtime override.
Scope: `tasks/task-discussion-plan.md`.
The unrelated `tasks/plan.md` and `tasks/todo.md` remain unchanged.

## Toolbar UX follow-up (2026-09-27)

- [x] Reproduce missing toggle states/history availability before implementation.
- [x] Add icons, accessible pressed states, and persistent typing formats.
- [x] Preserve selection/focus for keyboard, touch and pointer actions.
- [x] Separate inline code from code blocks and disable incompatible controls.
- [x] Verify block/list toggles, table-cell formats, links and Undo/Redo.
- [x] Separate draft-notice dismissal from confirmed saved-draft deletion.
- [x] Cover storage failure without losing recovery or newer typing.
- [x] Complete independent review and simplification/re-review; no must-fix findings.
- [x] Pass 45 focused browser checks across Chromium/WebKit and responsive sizes.
- [x] Pass final gen:check, validate, Go race tests and 192 frontend tests.
- [x] Complete the full browser suite: 157 passed; record runtime/warning boundaries.
- [x] Refresh the existing port-4180 preview without resetting fixture data.

## Implementation

- [x] Verify API v2 against official OpenAPI and isolated Vikunja 2.5.0.
- [x] Add typed list/single/create/update/delete adapters and error tests.
- [x] Add authenticated GraphQL operations, CSRF guards and generated types.
- [x] Add dedicated Discussion route and task-detail navigation.
- [x] Add approved Lexical packages and DOMPurify.
- [x] Sanitize upstream/pasted HTML and render explicit React elements.
- [x] Add native-compatible quote replies and lazy original-comment lookup.
- [x] Add edit/delete, confirmed deletion, ordering and pagination.
- [x] Add optional versioned drafts with explicit recovery and input precedence.
- [x] Preserve text on failure and prevent automatic ambiguous-write retries.
- [x] Prevent lossy editing of unsupported native content.
- [x] Document behavior, token permissions, API and limitations.

## Review and verification

- [x] Run review, fix and simplification loop; no remaining must-fix findings.
- [x] Run `task gen:check`.
- [x] Run `task validate`.
- [x] Run `task test`: Go race tests and 170 frontend tests pass.
- [x] Run `task e2e`: 43 tests pass, including 11 Discussion cases.
- [x] Check mobile, WebKit, tablet and desktop Discussion workflows; inspect
      mobile and desktop screenshots.
- [x] Run production dependency audit: no known vulnerabilities reported.
- [x] Keep Vikunja requests/token in the backend; browser operations use GraphQL.
- [x] Record verification boundaries and console warnings in
      `docs/specs/task-discussion-verification.md`.
- [ ] User acceptance on physical mobile devices and production instance.
- [ ] Explicit user authorization before any commit or push.

The final two items are release/user gates, not missing implementation steps.

## Approved editor/media extension (2026-09-27)

- [x] Confirm attachment API against the running pinned Vikunja 2.5.0 OpenAPI.
- [x] Install approved Lexical code-core/code-prism/table/markdown 0.51.0 packages.
- [x] Add bounded authenticated GraphQL uploads and attachment metadata.
- [x] Add authenticated, private, same-origin attachment streaming with ranges.
- [x] Add code blocks, highlighting, language controls, literal paste and copy.
- [x] Add tables, checklists, separators, Markdown shortcuts and text formats.
- [x] Add image paste/drop/picker, alt editing and audio/video playback.
- [x] Preserve native HTML, replies, drafts and input during asynchronous uploads.
- [x] Cover security, failures, round trips, draft collisions and all viewport sizes.
- [x] Review → fix → simplify → re-review the complete patch.
- [x] Run final focused tests, gen:check, validate, test and e2e.
- [x] Obtain an all-green full E2E run: 67 passed with Chrome for Testing Canary 156.
- [x] Update README, specs and verification evidence with limitations/permissions.

### Extension checkpoint

Implementation and review are complete. Final results: gen:check, validate,
Go race tests and 172 frontend tests pass; E2E has 67 passed with the explicit
Canary 156.0.8075.0 override and unchanged WebKit. Evidence and reproduction:
`docs/specs/task-discussion-verification.md`. Bundled Chromium 153 and stable 154
still crash with SIGILL on video in this ARM64 container, independently of the
app. The regression remains enabled and passes on the approved newer runtime.

## CMS-aligned editor simplification follow-up

- [x] Inspect active CMS configuration and its pinned shortcut implementation.
- [x] Separate editor configuration, behavior, Markdown and link controls.
- [x] Share text-format controls and stabilize the official transformer list.
- [x] Reproduce and fix soft-line code fences with Enter/Space.
- [x] Protect inline-code literals, surrounding text, formatting and selections.
- [x] Complete review → fix → simplification → re-review.
- [x] Run final focused desktop E2E: 8 passed.
- [x] Run gen:check, validate and Go race tests; 183 frontend tests passed.
- [x] Run full E2E: 87 passed with approved Canary override and bundled WebKit.
- [x] Document behavior, source comparison and verification boundaries.

The existing preview was not restarted or reset; final tests used fresh isolated
builds. No commit, push or deployment was performed.

## Immediate code fence and typography follow-up

- [x] Verify Lexical 0.51.0 input behavior and Tailwind 4.3.3 styling guidance.
- [x] Reproduce the missing immediate shortcut in browser tests before fixing.
- [x] Convert the third typed backtick, including after a soft line break.
- [x] Preserve paste, inline code, surrounding text and Undo/Redo.
- [x] Use shared Tailwind typography and block layout for editor code.
- [x] Review and simplify scoped changes; add clipboard and saved-style coverage.
- [x] Verify focused responsive browser tests: 25 passed; inspect mobile/desktop screenshots.
- [x] Run final gen:check, validate, Go race tests, 192 frontend tests and 112 E2E cases.

The existing preview now serves the updated build on port 4180. Its Vikunja
fixture and task data were preserved. No commit, push or deployment was performed.

## Reply-chain navigation follow-up

### Quote authors and focus follow-up

- [x] Show Vikunja avatars with initials fallback and source author names.
- [x] Place a compact arrow beside the author, above full-width quote text.
- [x] Keep focused comment dimensions and wrapping unchanged.
- [x] Document optional avatar permissions and bounded GraphQL transport.
- [x] Review/re-review; fix contrast and duplicate accessibility landmarks.
- [x] Pass 25 focused browser cases, generation/validation, Go race checks,
  192 frontend tests and 186 full E2E cases. Preserve preview fixture data.

- [x] Put an accessible arrow at the start of source quotes.
- [x] Scroll/focus loaded originals and fetch off-page originals on demand.
- [x] Follow and retrace chains without nesting dialogs or changing drafts.
- [x] Preserve snapshots; handle deleted originals, retry and cyclic references.
- [x] Review and simplify the scoped implementation; no required findings.
- [x] Run 10 focused responsive regressions, gen:check, validate, Go race tests,
  192 frontend tests and 171 full E2E cases.
