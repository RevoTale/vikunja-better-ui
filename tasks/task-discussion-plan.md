# Implementation Plan: Task Discussion

## Status

2026-10-01 audit: implemented; unchecked design-era criteria below are historical,
not a new backlog. See [the implementation checklist](task-discussion-todo.md)
and [current plan status](README.md). Physical-device/production acceptance remains
separate from automated CI verification.

Reply navigation follow-up complete: quote-leading arrows, an in-memory return
trail and one lazy original-comment dialog preserve snapshots, source IDs and
drafts. Ten focused responsive cases, gen:check, validate, Go race tests,
192 frontend tests and 171 full E2E cases passed. Independent review and
re-review found no required changes. Preview data was preserved.

Toolbar UX follow-up complete: visible format toggles and icons, preserved
selection/focus for pointer/touch/keyboard activation, distinct inline/block
code, accurate history availability, and explicit safe draft actions. Browser
regressions cover new typing, selected text, links, block types and recovery.
Independent review/re-review, 45 focused browser cases, gen:check, validate,
Go race tests, 192 frontend tests and 157 full E2E cases passed. The existing
port-4180 preview was refreshed without resetting task data.

Immediate-code-fence and typography follow-up is complete: conversion on the
third typed backtick preserves literal paste/history/inline code; proportional
Tailwind styling is shared between editing and display. Red/green reproduction,
review/simplification, 25 focused browser cases, gen:check, validate, Go race
tests, 192 frontend tests and 112 full E2E cases passed. See the verification
record for runtime details and remaining boundaries.

CMS-aligned simplification follow-up is complete: retained the HTML stack and
approved dependencies, separated editor configuration/input/Markdown/link
responsibilities, stabilized shortcut registration, and fixed code fences after
soft line breaks with red/green regressions. Bare and language-qualified fences
with Enter/Space pass on Chromium/WebKit, preserving surrounding text. Final
gen:check, validate, Go race tests, 183 frontend tests and 87 E2E cases pass.
The CMS source and deliberate differences are recorded in the rich-text spec;
the verification record documents the runtime override and remaining warnings.

The editor/media extension approved on 2026-09-27 is implemented and reviewed.
Its initial final checks passed with 67 E2E cases using the approved Chrome for Testing
Canary 156 runtime override and unchanged WebKit. Bundled Chromium 153 and
stable 154 retain an environment-specific ARM64 video crash. See the dedicated
checklist and verification record for exact results and runtime requirements.

Approved packages: official Lexical code/highlighting, table and Markdown
packages aligned with 0.51.0. Approved architecture exception: authenticated
same-origin binary streaming through Go; uploads and metadata remain GraphQL.
Files remain Vikunja task attachments. Removing a reference or abandoning a
draft never deletes a shared attachment. No third-party embeds or source/diff
editor are included.

Threat boundaries: browser files/HTML and upstream metadata/bytes are untrusted.
Require session and CSRF for uploads, exact Origin before multipart parsing,
bounded file/request sizes, MIME sniffing, and validated numeric attachment
paths. Do not forward arbitrary URLs, redirects, upstream cookies or tokens.
Stream bytes with bounded memory and private no-store responses; whitelist
response headers and inline media MIME types. Preserve unknown content without
silently making lossy edits. Upload failures never trigger automatic retries.

Implemented and verified on 2026-09-26. The original phase acceptance lists
below describe the approved plan, not live progress. See
`tasks/task-discussion-todo.md` for completion and
`docs/specs/task-discussion-verification.md` for evidence and boundaries.
This plan is intentionally separate from the existing
unfinished plans in `tasks/plan.md` and `tasks/todo.md`; those plans are not
part of this feature.

2026-09-26 verification: API v2 lists paginated comments, creates with POST,
updates with PUT/PATCH, and deletes with DELETE. Earlier v1/bare-array claims
in draft specs were incorrect and have been corrected. Respect upstream page
size caps. CMS source at `954a3134e7cdbfa36e5d490a136222de080a0f06` uses
MDXEditor over Lexical with feature-owned toolbar modules. Better UI uses
Lexical directly for native HTML quote compatibility and its Base UI controls.
DOMPurify was explicitly approved. Do not equate Lexical import with HTML
sanitization. Lexical packages are approved as part of this plan.

## Overview

Add a dedicated Discussion page for an existing task. It will use the current
Go GraphQL proxy and Vikunja as the only comment store, while a feature-owned
Lexical wrapper provides comfortable rich-text editing on desktop and mobile.
Replies will follow Vikunja's native semantics: a reply is a normal comment
whose body starts with a quoted block containing the source comment. This
keeps the feature compatible with Vikunja and avoids introducing a second
thread database.

The browser will never call Vikunja directly and will never receive the
Vikunja API token.

## Verified constraints and sources

- Vikunja exposes task comment list/create/update/delete operations through its
  API: [official API documentation](https://try.vikunja.io/api/v1/docs) and
  [official v2 API documentation](https://try.vikunja.io/api/v2/docs).
- Vikunja's `TaskComment` has a body, author, task ID, reactions and timestamps,
  but no parent-comment field:
  [official model](https://github.com/go-vikunja/vikunja/blob/main/pkg/models/task_comments.go).
- Vikunja's own UI implements Reply by inserting
  `blockquote[data-comment-id]` into a normal comment body:
  [official Comments.vue](https://github.com/go-vikunja/vikunja/blob/main/frontend/src/components/tasks/partials/Comments.vue).
- Lexical provides the modular React editor and HTML import/export used by this
  feature: [Lexical](https://lexical.dev/),
  [`@lexical/html`](https://lexical.dev/docs/api/modules/lexical_html), and
  [`LexicalComposer`](https://lexical.dev/docs/api/modules/lexical_react_LexicalComposer).
  The implementation must check the current package guidance before choosing
  between the legacy composer and the newer extension composer.

The CMS comparison is verified at the commit above. The local editor uses the
current extension composer, not Payload/Next.js or CMS-private imports.

## Architecture decisions

1. **One source of truth.** Vikunja remains authoritative for comment bodies,
   authors, timestamps and permissions. Better UI adds no database or server
   side reply table.
2. **Separate feature modules.** Add a small Vikunja comments adapter, a
   `task-discussion` service/resolver boundary, and a frontend
   `features/task-discussion` module. Do not expand the unrelated task client
   interface with comment concerns.
3. **Typed GraphQL facade.** Expose modeled comment fields and explicit
   mutations. The browser cannot submit author, timestamps or permission data;
   every state-changing input carries the existing CSRF token.
4. **Quote-based replies.** Store replies as ordinary Vikunja comments with a
   visible quote block. `quotedCommentId` is derived for display only and is
   never an authorization input.
5. **Safe rich text.** Store the Vikunja HTML body, but never render upstream
   HTML with `dangerouslySetInnerHTML`. Use DOMPurify before Lexical import/export
   and a lightweight React renderer for display, allow the supported node set, and validate
   link schemes (`http`, `https`, and `mailto`) before rendering or opening.
6. **Drafts are local and fail-open.** Keep versioned per-task drafts in
   `localStorage`. Offer explicit recovery and never replace non-empty editor
   content. Storage errors must not block editing or saving.
7. **Bounded loading.** Use the upstream comment ordering/pagination contract
   after Phase 0 verification. Do not invent `hasMore` semantics if the
   deployed Vikunja endpoint is unpaginated; in that case expose a bounded
   result and document the limit.

## Dependency graph

```text
Vikunja comment contract discovery
          |
          +--> typed Go client + mapping/error policy
          |          |
          |          +--> GraphQL query/mutations + generated types
          |                         |
          +--> Lexical adapter + safe HTML/quote utilities
                                     |
                       Discussion page read/create/reply/edit/delete
                                     |
                         integration, E2E, docs and final quality gates
```

## Ordered implementation tasks

### Phase 0: Contract and dependency discovery

#### Task 1: Verify the deployed Vikunja comment contract

**Description:** Confirm the exact API version, endpoint paths, response shape,
ordering parameters, pagination behavior, permission failures and malformed
response behavior against the official OpenAPI and the isolated E2E harness.
Confirm the current Lexical package guidance and the smallest package set that
supports the required editor nodes and HTML import/export.

**Acceptance criteria:**

- [ ] The plan records the exact Vikunja requests and response fields actually
      used by the current instance/harness.
- [ ] Pagination is either verified and modeled, or explicitly documented as
      unavailable with a safe bounded fallback.
- [ ] The Lexical composer choice and package list are source-backed; no CMS
      private import is required.
- [ ] Any additional sanitizer dependency is identified separately and is not
      added implicitly.

**Verification:** Compare the official API/OpenAPI with a mocked request and an
isolated harness response; run the frontend dependency/type check after the
package decision.

**Dependencies:** None.

**Files likely touched:** `docs/specs/task-discussion-api.md`,
`docs/specs/task-discussion-rich-text.md`, possibly `frontend/package.json` and
`frontend/pnpm-lock.yaml` only after the package choice is approved.

**Estimated scope:** Small.

### Phase 1: Read-only discussion vertical slice

#### Task 2: Add the Vikunja comments adapter and mapping tests

**Description:** Add typed comment transport models and list/create/update/delete
methods beside the existing Vikunja client. Preserve bearer-token forwarding,
timeouts, response-body cleanup and the project's upstream error taxonomy.

**Acceptance criteria:**

- [ ] Exact verified paths, methods, query parameters and content types are
      covered by `httptest` tests.
- [ ] Author, body, created/updated timestamps and upstream errors map without
      fabricated values.
- [ ] Permission, not-found and malformed-response cases remain distinguishable
      to the service layer.

**Verification:** Focused `go test` for `internal/vikunja` with race detection.

**Dependencies:** Task 1.

**Files likely touched:** `internal/vikunja/comments.go`,
`internal/vikunja/types.go`, `internal/vikunja/client_test.go` (or a focused
comments test file), `internal/vikunja/api.go` only if a shared helper is
required.

**Estimated scope:** Medium.

#### Task 3: Expose the typed GraphQL read contract

**Description:** Add the comment types, query and resolver/service mapping to
the GraphQL schema. Keep resolvers thin and keep comment operations behind a
small interface so existing task workflows are unchanged.

**Acceptance criteria:**

- [ ] `taskComments` returns typed items, ordering metadata and the verified
      pagination/bounded-result semantics.
- [ ] Task ownership/visibility and upstream authorization failures are mapped
      to stable user-safe GraphQL errors.
- [ ] Generated gqlgen and frontend operation types are produced by `task gen`,
      not edited manually.

**Verification:** GraphQL resolver tests cover successful reads, CSRF-independent
read access, invalid task IDs, upstream 403/404 and mapping failures; run
`task gen:check`.

**Dependencies:** Task 2.

**Files likely touched:** `internal/graphql/schema/schema.graphqls`,
`internal/service/task_discussion.go`,
`internal/graphql/resolver/task_discussion.go`, focused resolver tests, and
generated files through `task gen`.

**Estimated scope:** Medium.

#### Task 4: Build the read-only Discussion route

**Description:** Add a route reachable from task detail, showing task context,
loading/empty/error states, oldest-first default ordering and a local order
toggle. Keep the list usable at narrow mobile widths and preserve the existing
`returnTo` navigation convention.

**Acceptance criteria:**

- [ ] A user can open Discussion for an existing task and reload it without
      losing the task context.
- [ ] Comments render through sanitized explicit React elements; no raw HTML
      injection is used.
- [ ] Loading, empty, upstream error and retry states are visible near the
      affected content.
- [ ] The task detail action links to the route on desktop and mobile.

**Verification:** Frontend unit/component tests for state transitions and a
Playwright smoke test for navigation and read-only rendering.

**Dependencies:** Tasks 1–3 and generated GraphQL types.

**Files likely touched:** `frontend/src/features/task-discussion/*`,
`frontend/src/routes/_authenticated.tasks.$taskId.discussion.tsx`, task detail
actions, and the feature GraphQL operation file.

**Estimated scope:** Medium.

### Checkpoint: Read-only slice

- [ ] `task gen:check`, focused Go tests and frontend type/lint checks pass.
- [ ] The Discussion route loads real harness comments without a direct browser
      request to Vikunja.
- [ ] Review the verified pagination and Lexical decisions before mutation work.

### Phase 2: Editing and replies

#### Task 5: Add the feature-owned Lexical composer and HTML policy

**Description:** Implement the editor wrapper with the verified current Lexical
composer, supported nodes (paragraphs, headings, bold, italic, inline code,
lists, blockquotes and links), HTML import/export, empty-body validation and
safe-link handling. Keep all Lexical-specific code behind the feature module.

**Acceptance criteria:**

- [ ] HTML round-trips for supported nodes without dropping ordinary text.
- [ ] Unsafe URL schemes are rejected or rendered as inert text.
- [ ] The editor is keyboard-usable and comfortable on mobile.
- [ ] No raw `dangerouslySetInnerHTML` path is required for comments.

**Verification:** Vitest tests for import/export, links, quote blocks, empty
content and unsupported HTML; browser smoke check at desktop and mobile sizes.

**Dependencies:** Task 1.

**Files likely touched:** `frontend/src/features/task-discussion/editor/*`,
`frontend/src/features/task-discussion/rich-text/*`, `frontend/package.json`,
`frontend/pnpm-lock.yaml`.

**Estimated scope:** Medium.

#### Task 6: Add create-comment and draft recovery

**Description:** Connect the composer to the GraphQL create mutation and add a
separate versioned localStorage draft module. Recovery is explicit and never
overwrites non-empty current editor content; failed saves keep the editor body.

**Acceptance criteria:**

- [ ] A valid comment is created and appears in the current order after the
      mutation completes.
- [ ] Empty comments are rejected before the network request.
- [ ] Draft recovery shows a visible indicator and is dismissible.
- [ ] Existing non-empty input always wins over a stored draft, including after
      delayed storage reads or a route transition.
- [ ] Storage quota/availability errors do not break the composer.

**Verification:** Unit tests for draft precedence/versioning and mutation state;
GraphQL tests for CSRF and failed writes; Playwright create/reload/draft-recovery
flow.

**Dependencies:** Tasks 3 and 5.

**Files likely touched:** `frontend/src/features/task-discussion/drafts/*`,
composer/container files, feature GraphQL operations, focused tests.

**Estimated scope:** Medium.

#### Task 7: Add quote-based reply and comment anchors

**Description:** Add a Reply action that inserts Vikunja-compatible quote markup,
tracks the source ID only for display, focuses the composer, and scrolls/highlights
the source comment when a quote is selected. Do not introduce server-side
parent/child records.

**Acceptance criteria:**

- [ ] Reply body starts with the allowed
      `blockquote[data-comment-id]` plus an editable paragraph.
- [ ] Saving a reply uses the same create mutation as a normal comment.
- [ ] Selecting a quote focuses the source comment when loaded and fetches the
      single original comment in a dialog when it is outside the current page.
- [ ] Forged quote IDs do not affect authorization or mutation targets.

**Verification:** Pure quote parser/serializer tests, resolver tests showing the
quote ID is never trusted for authorization, and Playwright reply/navigation
coverage on narrow and wide viewports.

**Dependencies:** Tasks 4–6.

**Files likely touched:** reply utilities, comment list/card, composer state,
feature tests and E2E spec.

**Estimated scope:** Medium.

### Checkpoint: Write and reply slice

- [ ] Create, draft recovery and quote-based reply pass focused tests and E2E.
- [ ] A failed mutation leaves the user's content intact and exposes a retry.
- [ ] Review the rendered HTML/link safety behavior before edit/delete work.

### Phase 3: Maintenance UX and hardening

#### Task 8: Add edit, delete, order and long-conversation controls

**Description:** Add permission-aware edit/delete actions for comments, preserve
quote blocks while editing, implement the verified ordering/pagination controls,
and keep destructive actions confirmed with the affected comment identified.

**Acceptance criteria:**

- [ ] Only actions permitted by the upstream contract are offered; unauthorized
      operations produce a safe error and preserve local content.
- [ ] Editing updates the displayed comment and keeps quote markup intact.
- [ ] Deleting requires confirmation and removes only the selected comment.
- [ ] Ordering and pagination do not duplicate or silently drop comments.

**Verification:** Client/resolver tests for update/delete/error mapping and E2E
coverage for edit/delete/order/pagination.

**Dependencies:** Tasks 3, 6 and 7.

**Files likely touched:** comment card/list, mutation hooks, GraphQL operations,
focused Go/frontend tests.

**Estimated scope:** Medium.

#### Task 9: Accessibility, responsive polish and documentation

**Description:** Finish keyboard focus management, screen-reader labels, mobile
keyboard-safe layout, retry/saving feedback, and maintainer/integrator
documentation. Document that replies are quote-based Vikunja comments and list
the public GraphQL operations and limitations.

**Acceptance criteria:**

- [ ] Focus moves predictably after reply, save, error and delete actions.
- [ ] No horizontal overflow or inaccessible controls at the supported mobile
      viewport.
- [ ] README/API documentation describes route, GraphQL operations, draft
      behavior, link policy and out-of-scope limitations.

**Verification:** Playwright keyboard/mobile checks, `task validate`, and a
documentation link/command review.

**Dependencies:** Task 8.

**Files likely touched:** feature components/styles, `README.md`,
`docs/specs/task-discussion*.md`, E2E tests.

**Estimated scope:** Medium.

#### Task 10: Full verification and release gate

**Description:** Run generated-code checks, focused and full tests, race checks,
frontend validation and the isolated demo. Resolve only feature-related
failures and report unrelated baseline failures separately.

**Acceptance criteria:**

- [ ] `task gen:check`, `task validate`, `task test` and `task e2e` pass after
      the final edit, or each failure has a documented root cause and boundary.
- [ ] No browser request exposes the Vikunja token.
- [ ] The final diff contains no generated-file hand edits or unrelated plan
      changes.

**Verification:** Record command output and a final manual desktop/mobile smoke
check.

**Dependencies:** Tasks 1–9.

**Files likely touched:** Tests/docs only unless verification exposes a feature
defect.

**Estimated scope:** Small to medium.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Deployed Vikunja differs from the public docs | High | Make Phase 0 verify the exact instance and harness contract before freezing GraphQL pagination. |
| Comments are HTML and may contain unsafe links/markup | High | Use a restricted Lexical importer/renderer and scheme validation; never inject raw HTML. |
| Lexical package/configuration drifts from the CMS | Medium | Keep a local adapter, use official current packages, and treat CMS config as a reference rather than an import. |
| Large discussions create slow or duplicate requests | Medium | Use verified upstream ordering/pagination, bounded page state and cache-aware GraphQL queries. |
| Draft recovery overwrites a user's current text | High | Make recovery explicit and add delayed-read/race tests where non-empty current content always wins. |
| Upstream permission rules differ for edit/delete | Medium | Map upstream 403/404 explicitly and derive available actions from returned capabilities/errors, not client assumptions. |

## Resolved implementation decisions

API v2 has verified pagination. Use a dedicated Discussion route and direct
Lexical extensions, with the CMS as a UX reference. Open a single quoted
original on demand instead of scanning pages. Keep writes non-retrying when
confirmation is uncertain. See companion verification notes for final evidence.

## Task-detail composition follow-up

User-approved scope: redesign the task detail page around description, compact
properties and inline Discussion, while retaining the standalone Discussion page.

1. Add a responsive end-to-end regression for embedded comments, description
   rendering and preserved standalone navigation/drafts.
2. Extract the existing conversation into one reusable `DiscussionThread`;
   keep page-specific headings/navigation in its route wrapper.
3. Compose a task-detail description column and properties panel, retaining all
   existing actions and recurrence settings. Reuse sanitized HTML rendering.
4. Verify desktop/mobile and existing editing/discussion workflows, review and
   simplify, then run generation, validation and safe tests. Refresh preview
   without resetting its isolated fixture. No commit or push.

Completed: shared thread, responsive description/properties composition,
documentation, review/fix/simplification/re-review and preserved preview.
Final evidence: 20 focused and 206 full browser cases passed, plus generation,
validation and safe tests. See the task-detail verification record.
