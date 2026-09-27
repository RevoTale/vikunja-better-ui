# Task Discussion Verification

## Task-detail composition: 2026-09-28

Task details now place the formatted description before Discussion, with a
desktop properties sidebar and a single-column mobile layout. Both routes use
one `DiscussionThread`; standalone navigation, replies, uploads and draft
recovery retain their existing workflows. Description rendering reuses the
sanitized renderer and preserves LF, CRLF and CR in legacy plain text.

- Final focused browser suite: 20 passed across Chromium 320/768/1024/1440 and
  mobile WebKit. Covers HTML safety, no external iframe requests, plain-text
  line endings, inline posting, cross-route draft recovery, isolated comment
  errors, accessibility and task-list count navigation.
- Full `task e2e`: 206 passed in 4.1 minutes against isolated Vikunja 2.5.0.
  Chromium uses the approved executable override; WebKit is bundled.
- `task gen:check`, `task validate` and `task test` passed after the final code
  change: Go race tests and 193 frontend tests in 37 files.
- Mobile and desktop screenshots were inspected. Review, fixes, simplification
  and re-review found no remaining required changes.
- Axe exposed insufficient contrast in the old destructive-style Delete link.
  It now uses outline styling; deletion still requires its separate confirmation.
- The full suite exposed a page-1 assumption in the count test. It now follows
  real pagination. Review also caught plain-text CRLF normalization; regression
  coverage includes all three line-ending forms.
- Logs: `.cache/e2e/task-detail-focused-final.log`,
  `.cache/e2e/task-detail-e2e-final.log` and
  `.cache/e2e/task-detail-{gencheck,validate,test}.log`.
- The previously recorded WebKit CSP warning on Today remains. No physical
  device, production deployment, commit or push is claimed.

## Task-list discussion counts: 2026-09-28

UI lists/week request `expand=comment_count` with task pages. Integration Jobs
and recurrence retry searches retain their previous requests. The compact link
counts all comments/replies, hides zero/unknown values and computed occurrences,
and preserves the list return destination. Expanded counts are excluded from
task edit-version hashing; a regression reproduced the mismatch before the fix.

- Focused browser checks: 16 passed, covering count navigation/deletion on all
  five responsive browser profiles and task-editing regressions. Axe passed and
  the 320px screenshot was inspected.
- Final `task gen:check`, `task validate` and `task test` passed, including Go
  race checks and 193 frontend tests. Full E2E was not rerun for this follow-up.
- Independent scoped review found no required fixes. No new dependency.
- Logs: `.cache/e2e/comment-count-{browser-final,gencheck,validate,test}.log`.

## Author typography hierarchy: 2026-09-28

Main authors now use 16px semibold foreground text; quoted authors use 14px
normal muted text. The original-comment dialog matches the main-author style.
A browser regression first failed because both names were 14px. It now verifies
different computed sizes, weights and colors. Twenty focused cases passed across
Chromium at 320/768/1024/1440 and mobile WebKit, including Axe and stable focus.
The mobile screenshot was inspected. `task gen:check`, `task validate` and
`task test` passed after the final code change (Go race tests and 192 frontend
tests). The full E2E suite was not rerun for this typography-only follow-up.
Logs: `.cache/e2e/author-type-{red,browser,gen,validate,test}.log`.

## Quote authors and stable focus: 2026-09-28

Quote headers show the source author's name and Vikunja profile image, with
initials while loading or on failure. A 32px arrow sits beside the author, above
the full-width quote. Constant comment padding and radius prevent focus reflow.

- Regression tests first reproduced missing author headers and focus reflow.
- Focused browser checks: 25 passed across Chromium 320/768/1024/1440 and mobile
  WebKit. They cover native profile-image upload/rendering, initials fallback,
  cache reuse, header layout, focus dimensions, reply chains and pagination.
- Axe caught low-contrast initials and repeated landmark labels during the
  implementation. Both were corrected and the unchanged checks passed.
- Go tests cover session enforcement, permission failures, unsafe names and
  formats, oversized bodies/dimensions and blocked redirects.
- Final `task gen:check`, `task validate` and `task test` passed, including Go
  race checks and 192 frontend tests in 37 files.
- Full `task e2e`: 186 passed; none skipped. Chromium uses the approved Canary
  override; WebKit is bundled. No physical-device verification is claimed.
- Independent review and re-review found no remaining required changes.
  Mobile and desktop screenshots were inspected.

Logs: `.cache/e2e/quote-header-{focused-final,gen,validate,test,e2e}.log`.
The existing port-4180 preview was refreshed without resetting its fixture.
Readiness/login returned 200 and all 18 entry assets loaded. Existing preview
tokens without `other:avatar` use initials. No commit, push or deployment.

## Reply-chain navigation: 2026-09-28

The desktop regression failed before implementation because the quote had no
navigation button. Quote-leading arrows now focus loaded originals or fetch
one original on demand. A return trail supports Back and Close without changing
the comment HTML or composer state. A focused hook owns navigation; generated
shadcn components and GraphQL contracts are unchanged.

- Final focused browser checks: 10 passed across Chromium at 320/768/1024/1440px
  and mobile WebKit, against isolated Vikunja 2.5.0.
- Coverage: keyboard activation, loaded and off-page chains, return focus,
  deleted sources, retry, cyclic references, pagination and draft preservation.
  Returning during a delayed lookup closes the dialog without trapping focus.
- Mobile and desktop screenshots inspected; loaded-chain accessibility checks passed.
- `task gen:check` and `task validate`: passed; zero lint issues.
- `task test`: Go race checks and 192 frontend tests in 37 files passed.
- `task e2e`: 171 passed in 4.7 minutes; none skipped.
- Independent review, simplification and re-review: no required findings.

Chromium uses the approved Canary 156.0.8075.0 override; bundled WebKit is
unchanged. The existing unrelated Today CSP stylesheet warning remains in the
passing timezone test. Physical-device testing remains a user gate.

Logs: `.cache/e2e/reply-navigation-{red,green,focused,gen,validate,test,e2e}.log`.
The port-4180 preview serves the new build: readiness/login returned 200 and
all 18 entry asset references matched. Fixture data was preserved. No commit,
push or deployment.

## Toolbar interaction follow-up: 2026-09-27

Initial desktop regressions reproduced the missing pressed states, ambiguous
Code label and always-enabled Redo. Controls now use selection-derived toggle
states and a shared focus/selection action runner. Icons and 44px targets are
application wrappers over unchanged generated shadcn components. Draft
recovery distinguishes notice dismissal from confirmed local-draft removal.

- Focused browser suite: 45 passed across Chromium 320/768/1024/1440px and
  mobile WebKit. Mobile and desktop screenshots were visually inspected.
- Final `task gen:check` and `task validate`: passed, zero lint issues.
- Final `task test`: Go race checks and 192 frontend tests in 37 files passed.
- Final `task e2e`: 157 passed in 4.2 minutes; no skipped tests.
- Independent review → simplification → re-review: no remaining must-fix findings.

Coverage includes all eight text formats for new typing, selected-text changes,
keyboard/touch activation, inline versus block code, every block/list toggle,
history availability, link apply/remove/cancel (including a middle-document
selection), table-cell formatting, nested-table prevention, and failed draft
deletion without losing recovery. Confirm/cancel/dismiss paths preserve newer
typing and saved drafts appropriately. Looped editor resets use actual
select-all/backspace keystrokes, not direct contenteditable DOM replacement.

No dependency changes were needed for this follow-up. Chromium used the
previously approved Canary 156.0.8075.0 executable override; bundled WebKit was
unchanged. The existing Today CSP stylesheet warning remains in the passing
timezone WebKit test. Physical-device keyboard testing remains a user gate.

Logs: `.cache/e2e/toolbar-{red,focused}.log` and
`.cache/e2e/toolbar-final-{gen,validate,test,e2e}.log`.
The existing preview on port 4180 now serves the updated binary: readiness and
login returned 200, and all 18 entry asset references matched the build. The
Vikunja fixture and task data were preserved. No commit, push or deployment.

## Immediate code fences and typography: 2026-09-27

Verified inside the existing Dev Container against isolated Vikunja 2.5.0.
Three new desktop regressions failed before implementation because the third
backtick did not convert the paragraph. The expanded browser suite also caught
saved code shrinking twice (12.25px instead of 14px); the corrected nested-code
rule explicitly inherits font size rather than Tailwind's color-only `text-inherit`.

- Focused unit checks: 20 passed, including 9 immediate-fence cases.
- Focused browser checks: 25 passed across Chromium at 320/768/1024/1440px
  and mobile WebKit. Mobile and desktop screenshots were visually inspected.
- Final `task gen:check` and `task validate`: passed.
- Final `task test`: all Go race tests and 192 frontend tests in 37 files passed.
- Final `task e2e`: 112 passed in 2.9 minutes; no skipped tests.
- Independent review and re-review: no remaining must-fix findings.

Coverage includes the immediate third-key trigger, soft lines, literal clipboard
paste, inline code, Undo/Redo, retained surrounding text, code whitespace,
horizontal overflow, and matching saved/editor heading/code/subscript sizes.
The bounded shortcut update retains a separate undo step; ordinary typing does
not schedule another editor update. No dependency or generated UI changes.

Chromium used the previously approved Canary 156.0.8075.0 executable override;
WebKit was unchanged. The existing timezone WebKit test still logs a CSP
stylesheet warning on Today. It passed; this change does not claim to fix that
warning or qualify physical mobile keyboards/production behavior.

Logs: `.cache/e2e/immediate-final-{gen,validate,test,e2e}.log` and
`.cache/e2e/immediate-responsive-final.log`. The existing preview on port 4180
was refreshed without resetting its fixture. Readiness returned 200 and all
19 entry asset references matched the latest build. No commit, push or deployment.

## Module objective

Prove the discussion feature at the same boundaries used by production: rich
text safety, Vikunja mapping, GraphQL behavior and browser interaction.

## Editor/media extension: 2026-09-27

Implemented and covered by focused checks:

- Attachment/client/service/HTTP/resolver focused Go race tests pass.
- `task gen` passes with the additive Upload and attachment metadata contract.
- Real Vikunja 2.5.0 E2E confirms upload, metadata listing, identical downloaded
  bytes, private caching, range handling and anonymous-access rejection.
- Rich-text E2E: literal code whitespace, syntax/language controls and copying,
  Markdown shortcuts, table controls, native table scaffolding, checklists,
  extended formats and protection against lossy native editing.
- Media E2E: image paste/drop/picker, alternative text, draft recovery, delayed
  upload input precedence, deleted placeholders, uncertain upload reuse and
  explicit retries. Removing a reference leaves the attachment intact.
- Mobile WebKit plays uploaded WAV and WebM through the real attachment path;
  native controls have no autoplay. Image/editor workflows pass across phone
  Chromium/WebKit, tablet and desktop sizes, including axe accessibility checks.
- Media-reference unit tests reject arbitrary URLs, credentials, query tokens
  and invalid numeric identities.

Native Vikunja 2.5.0 browser inspection confirmed quote IDs, literal code,
checklists and uploaded image references. Native saves add neutral table
column scaffolding; Better UI normalizes it without blocking edits. Mentions,
custom deep links, image titles and custom sizing remain read-only here.
Native highlight/sub/sup formats and media players have documented limitations.

Review → fix → simplification → re-review found and fixed queued Lexical node
insertion, native-content loss guards and MIME classification edge cases.
Clipboard import is a focused module; editor and code highlighting are lazy
loaded. Production builds no longer exceed the 500 KB chunk warning threshold.
The final FLAC regression proves unsupported pinned-upstream variants are
rejected before any attachment upload.

### Browser-runtime compatibility

The bundled desktop Chromium video E2E failed during video rendering.
Depending on timing, Playwright reports `Target crashed` or an interrupted
controls/autoplay attribute assertion.
Browser diagnostics report SIGILL in the container's Playwright Chromium ARM64
binary. The same generated WebM also crashes a standalone blob-video page,
without Better UI, GraphQL or Vikunja. Both headless-shell and full Chromium
were tried; neither resolved it. The same file renders and plays in WebKit.

Further isolation identified an instruction-set incompatibility in the bundled
Chromium 153.0.8010.12 (Playwright revision 1243): the faulting address maps to
`cntd x9` at binary offset `0x50a07ac`, before `smstart sm` at `0x50a07d0`.
The container's CPU reports SME but no non-streaming SVE. This matches the
[upstream libyuv fix](https://chromium.googlesource.com/libyuv/libyuv/+/fab11704cda62ff2d6b5e308b741e759ae816035)
for compiler-emitted non-streaming SVE instructions in SME functions. A minimal
data-URL video page reproduces the fault without the app or network.

On 2026-09-27 the npm registry still reports installed Playwright 1.63.0 as the
latest stable release. With explicit user approval, official Chrome for Testing
154.0.8037.57 and Canary 156.0.8075.0 were installed inside the existing container's
ignored project cache. Stable 154 still crashes on the standalone reproduction.
Canary 156 plays and renders it, and passes the unchanged focused uploaded-video
E2E against Vikunja. No binary patches, CPU-feature shims, skipped tests or
weakened assertions were introduced.

The optional `E2E_CHROMIUM_EXECUTABLE` selects that already-installed executable
for Chromium projects only. WebKit and the default bundled-browser setup remain
unchanged. This is a test-runtime override, not an application dependency or a
claim that affected stable Chromium builds are fixed. Physical-device testing
remains separate.

Reproduce the verified runtime selection inside the existing Dev Container:

```sh
E2E_CHROMIUM_EXECUTABLE=/workspaces/vikunja-better-ui/.cache/e2e/chrome-156.0.8075.0/chrome-linux-arm64/chrome task e2e
```

The binary came from the official Chrome for Testing `linux-arm64` archive for
156.0.8075.0; it is not committed or bundled with the application.

### Final checks after the last code/test changes

All commands ran through `docker exec` in the existing Dev Container, using
the isolated Vikunja 2.5.0 fixture. No containers were created or restarted.
The final full run used Chrome for Testing Canary 156.0.8075.0 for Chromium
projects and unchanged bundled WebKit. The focused uploaded-video regression
passed first; all four required commands then passed after the final code change.

| Check | Result |
|---|---|
| `task gen:check` | Passed; generated files reproducible |
| `task validate` | Passed; Go formatting/vet/lint/build, Biome, TypeScript, Vite |
| `task test` | Passed; all Go race tests and 172 frontend tests in 35 files |
| `task e2e` with the explicit Chromium executable override | **67 passed** in 1.9 minutes; no skips |
| `pnpm --dir frontend audit --prod --audit-level high` | No known vulnerabilities reported |
| `git diff --check` | Passed |

The exact-text code checks compare tabs and trailing newlines without
Playwright whitespace normalization, including clipboard copying. Closed
toolbars fit within 96px at every tested width while preserving 44px targets.
Mobile and desktop screenshots were inspected. WebKit video playback advances
`currentTime`; this is not merely a metadata or element-presence check.

Both independent review passes have no remaining must-fix code findings.
The final browser-override delta was independently reviewed without findings.
The upgrade is verified on the recorded runtimes; bundled Chromium 153 and
stable 154 still have the environment-specific video failure described above.
No test was skipped and no lint/type/safety rule was weakened.
No commit, push or deployment was performed.

## CMS-aligned editor follow-up: 2026-09-27

Inspected the pinned CMS source and MDXEditor 4.2.1 shortcut implementation;
no running CMS comparison was performed. The rich-text spec records the source
and why Better UI retains HTML-compatible Lexical rather than Markdown storage.
Separated configuration, input behavior, Markdown shortcuts and link controls;
shared text-format controls replace duplicate toolbar markup.

The reported soft-line fence failure was reproduced before the fix: Enter and
Space both left the fence as text. The narrow normalization now preserves the
preceding paragraph and delegates conversion to Lexical. Independent review
caught an inline-code edge case, covered with a failing regression before the
guard was added. Unit editors rethrow Lexical errors so assertions cannot be
silently swallowed by its default error handler. Re-review found no remaining
must-fix findings.

After the final code changes, all commands ran through `docker exec` in the
existing Dev Container with isolated Vikunja 2.5.0:

| Check | Result |
|---|---|
| Focused rich-text desktop E2E | 8 passed |
| `task gen:check` | Passed |
| `task validate` | Passed |
| `task test` | All Go race tests and 183 frontend tests in 36 files passed |
| `task e2e` | 87 passed in 2.4 minutes; no skips |
| `git diff --check` | Passed |

The full E2E run used the same approved Canary 156 override and bundled WebKit
described above. It includes bare and language-qualified fences with both
Enter and Space across phone Chromium/WebKit, tablet and desktop. The timezone
WebKit test still logs a CSP stylesheet rejection; the test passes, and this
does not establish a warning-free browser console. No new dependencies or
containers were added. The existing preview and its open draft were not reset;
these checks exercised fresh test builds, not a replacement preview process.

## Test matrix

| Boundary | Required coverage |
|---|---|
| Pure rich text | quote extraction, safe links, sanitizer, draft precedence |
| Vikunja client | list/create/update/delete, ordering, pagination, errors |
| GraphQL | auth, CSRF, permissions, stable error codes, generated types |
| Browser | open, create, reply, quote navigation, edit, delete, retry, mobile |
| Regression | existing task detail, task edit and generated-code checks |

## Required commands

```text
task gen:check
task validate
task test
task e2e
```

The final implementation must run focused tests after each vertical slice and
the full applicable suite after the last edit. A green unit suite alone is not
enough to claim browser or upstream compatibility.

## Documentation

The README should link to the Discussion feature behavior and explain that
replies are Vikunja-compatible quoted comments rather than server-side nested
threads. The public API documentation must describe the GraphQL operations and
the HTML safety boundary without exposing Vikunja credentials.

## Verified implementation: 2026-09-26

All project commands ran inside the existing Dev Container. The E2E harness
used isolated Vikunja 2.5.0, not production data.

| Check | Result |
|---|---|
| `task gen:check` | Passed; generated Go, operations and routes reproducible |
| `task validate` | Passed; formatting, Go vet/lint/build, Biome, TypeScript, Vite |
| `task test` | Passed; all Go race tests and 170 frontend tests in 34 files |
| `task e2e` | 43 passed, including 11 Discussion cases |
| `pnpm --dir frontend audit --prod --audit-level high` | No known vulnerabilities reported |

Discussion browser coverage includes Chromium and WebKit at 320px, tablet at
768px, and desktops at 1024px/1440px. It exercises create/reply/edit/delete,
draft recovery without overwriting input, unavailable storage, failed writes,
pagination, lazy original lookup, removal of the last page, HTML/paste safety,
and unsupported native content protection. The main workflow checks horizontal
overflow, accessible content with axe, and uncaught page errors. Mobile and
desktop screenshots were also visually inspected.

## Review and simplification outcomes

- A successful upstream PUT can omit author/created fields. Read the canonical
  comment afterward; a failed confirmation becomes `UPDATE_UNCONFIRMED` and
  must not trigger an automatic repeated write.
- Accept consistent empty out-of-range pages after deletion and clamp the UI
  to the last remaining page without clearing the composer.
- Insert imported Lexical nodes through a root selection, allowing plain native
  text and inline-only HTML without an invalid root TextNode.
- Align draft read/write limits; never report a draft saved when it cannot be
  recovered.
- Disable editing unsupported native tables/media/formats instead of silently
  stripping them on save. Keep a clear native-editor explanation.
- Extract the focused save hook while retaining the synchronous in-flight guard,
  uncertain-save lock and clear-only-after-confirmation behavior.

The final independent review found no remaining must-fix issues in this scope.

## Remaining boundaries

- Physical-device keyboard behavior and the production instance were not tested.
  Browser emulation and isolated integration tests do not establish those gates.
- Upstream offset pagination is not a snapshot. Concurrent changes and equal
  creation timestamps have the ordering limitations documented in the API spec.
- Full-suite WebKit runs logged a CSP stylesheet warning on the existing Today
  route; tests passed. This warning was not reproduced as a Discussion failure
  and is not claimed to be resolved by this feature.
- Deliberately failed GraphQL requests in existing error-state tests emitted
  expected network errors; the corresponding assertions passed.
- No commit, push or deployment is part of this verification.
