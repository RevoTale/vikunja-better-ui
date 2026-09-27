# Task Discussion

## Status

Initial Discussion and the approved editor/media extension are implemented and
verified. Runtime requirements and compatibility boundaries are recorded in
[task-discussion-verification.md](task-discussion-verification.md).

## Objective

Add a dedicated Discussion page for a task so the task can be maintained as a
long-lived working conversation. The page uses a mobile- and desktop-friendly
Lexical editor, stores comments in Vikunja, and provides quote-based replies
compatible with Vikunja's native UX.

The feature is for the authenticated Better UI user working on an existing
task. It must remain a focused task journal, not a second project-management
system.

## Capability map

| Module | Responsibility | Depends on |
|---|---|---|
| `discussion-api` | Vikunja comments adapter, GraphQL contract, permissions and errors | — |
| `discussion-rich-text` | Lexical wrapper, HTML serialization, links, quote blocks and draft recovery | — |
| `discussion-ux` | Discussion route, list, composer, reply, edit/delete and responsive behavior | `discussion-api`, `discussion-rich-text` |
| `discussion-verification` | Unit, integration, GraphQL and E2E coverage plus documentation | all previous modules |

Build order: `discussion-api` → `discussion-rich-text` → `discussion-ux` →
`discussion-verification`.

## Product behavior

- Open Discussion from the existing task detail page.
- Show comments oldest-first by default, with a toggle for newest first.
  Forward ordering and pagination to Vikunja API v2; load one page at a time.
- Create a comment with rich text and links.
- Add code blocks, tables, checklists and media backed by Vikunja task attachments.
- Reply to a comment by inserting a visible quote block containing the source
  comment. The quote is a normal Vikunja comment body, not a separate server
  thread.
- **View original** focuses the referenced comment with a visible focus ring.
  If it is not on the current page, fetch only that comment into a dialog.
  Do not scan pages to discover its position.
- Edit and delete comments according to Vikunja permissions. Preserve a reply
  quote when editing the rest of the comment.
- Keep a per-task local draft. Draft recovery is explicit and must never replace
  text the user has entered in the current editor session.
- Display loading, empty, saving, saved, draft-recovered and error states near
  the affected content. A failed save keeps the editor content.
- Use the existing authenticated session and CSRF flow. The browser never calls
  Vikunja directly.

## Data and architecture boundaries

- Vikunja is the source of truth for comments, authors, timestamps and
  permissions.
- Better UI exposes a typed GraphQL facade and keeps the Vikunja token in Go.
- Binary media streaming is the approved authenticated same-origin exception;
  uploads and metadata use GraphQL and no arbitrary URL proxy exists.
- No application database, server-side thread table or separate comment store.
- `replyToId` is a client/display concern derived from the quote block; the
  canonical value sent to Vikunja remains the HTML comment body.
- Rendered HTML must pass through an allowlist sanitizer. Do not inject raw
  upstream HTML into the DOM.
- External links are limited to safe schemes and use safe link attributes.
- The exact CMS Lexical configuration remains an implementation input. The
  application must depend on a local editor wrapper, not CMS-specific imports.

## Project structure

```text
internal/vikunja/comments.go                    # Vikunja comment transport/types
internal/service/task_discussion.go             # domain mapping and policy
internal/graphql/schema/discussion.graphqls     # discussion contract
internal/graphql/resolver/task_discussion.go    # thin resolvers
frontend/src/features/task-discussion/          # feature-owned UI and editor
frontend/src/features/task-discussion/discussion.graphql # typed operations
internal/graphql/resolver/task_discussion_test.go # GraphQL boundary tests
frontend/e2e/task-discussion*.spec.ts            # browser/API workflows
```

## Commands

```text
task gen
task gen:check
task validate
task test
task demo
```

## Testing strategy

- Unit tests cover quote extraction, HTML sanitization, safe-link rules, draft
  precedence and pagination state.
- Vikunja client tests cover list/create/update/delete mapping, permission
  failures and malformed upstream responses.
- GraphQL tests cover the public contract, CSRF enforcement and structured
  errors.
- E2E tests cover desktop and mobile layouts, create, reply, quote navigation,
  edit, delete, draft recovery, failed save and long-comment scrolling.
- No test may depend on a real external Vikunja instance; the isolated E2E
  harness supplies the fixture API.

## Success criteria

- A user can open a task's Discussion page and understand the task context
  without returning to the task editor.
- A comment can be written with Lexical on mobile and desktop and is visible
  after reload.
- Replying creates a Vikunja-compatible quoted comment and reliably navigates
  to the source comment.
- Edits and deletes preserve permissions and never lose the user's draft on
  failure.
- No browser request contains the Vikunja API token.
- All focused tests, generated-code checks, validation and the E2E suite pass.

## Boundaries

### Always

- Keep GraphQL resolvers thin and pass context through the request path.
- Validate and sanitize rich-text boundaries.
- Keep UI modules small and feature-owned.
- Add regression tests for every behavior change.

### Ask first

- Adding Lexical packages or changing the required dependency stack.
- Adding other dependencies, reactions, notifications or server-side persistence.
- Changing Vikunja API version or public GraphQL semantics.

### Never

- Call Vikunja from browser code.
- Store comments or replies in a new application database.
- Treat quote markup as a trusted authorization or identity field.
- Drop editor content after an upstream error.
- Edit generated GraphQL files by hand.

## Out of scope for the first release

- True nested server-side threads.
- Third-party embeds and source/diff editing.
- Reactions, subscriptions and notifications beyond Vikunja's existing
  comment behavior.
- Cross-task discussion feeds.
- Offline mutation queues.

## Decisions and limits

- Dedicated `/tasks/:taskId/discussion` route; no second inline discussion.
- CMS uses MDXEditor over Lexical. This feature uses Lexical's extension composer
  directly to exchange Vikunja HTML and reuse Base UI controls.
- DOMPurify is explicitly approved; a feature-owned sanitizer and React renderer
  avoid raw HTML injection and a full editor instance for every read-only comment.
- API v2 pagination defaults to 50, respecting the returned instance cap.
- Vikunja sorts by creation time without a tie-breaker for identical timestamps.
  Concurrent writes may move page boundaries; Refresh reads current data.
- Writes are never retried automatically. An uncertain save keeps the editor
  and requires explicit checking before retry. This is not an exactly-once API.
- Native permissions remain authoritative. Own-author actions are shown locally;
  revoked task/token permissions may still cause a safe error on submission.
