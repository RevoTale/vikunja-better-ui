# Plan: subtasks, related tasks, emoji and namespaced Job marker

## Status and scope

2026-10-01 audit: the namespaced Job marker is implemented and verified.
Manual subtasks, relations, automatic linking from confirmed content saves,
and the shared Lexical description editor with Unicode emoji are implemented.
The HTML parser and description migration were explicitly approved. Final
verification is recorded in [the checklist](task-relationships-todo.md), separately
from physical-device and production acceptance.
The user explicitly
approved the breaking change from `job` to `vbu:job` and excluded data migration.

This plan uses the recommended refinement defaults: automatic linking on Better
UI saves only; Unicode emoji picker/shortcodes, without reactions; independent
parent/child completion. Copy project, priority and ordinary labels when creating
a child. Ordinary-label inheritance is a Better UI choice, not Linear parity.

These feature-specific files follow the existing `tasks/task-*-*`
convention and do not replace other plans. The marker contract here supersedes
the legacy `job` reservation in the labels plan.

## Product contract

### 1. Breaking marker rename

- Recognize and create Jobs only through the exact canonical `vbu:job` marker.
- Do not keep a `job` compatibility alias. A legacy `job` label becomes ordinary
  metadata and can be displayed, selected and filtered like other user labels.
- Reserve the entire `vbu:` namespace in ordinary-label creation, selection,
  copying and display. Align frontend and backend normalization rules.
- Change marker handling, not the UI term Job, GraphQL `JOB` value, form field
  names, creation variants or existing route parameters named `job`.
- Update classification, creation/editing, completion/history, marker lookup,
  label controls, fixtures and current documentation together.
- Existing tasks with only `job` are no longer classified as Jobs. The user
  explicitly excluded migration; do not add relabeling, inventory or rollback
  tooling, a compatibility alias, or production data mutation.

### 2. Subtask experience

Show a Subtasks section below the description with direct-child completion
count, compact task rows, Add subtask and Attach existing task. Show the parent
on the child detail page. A child is a normal Vikunja task with its own detail
page, dates, labels and lifecycle.

Create quickly with title entry and optional property editing. Successful
creation keeps the parent visible and offers another child; Escape closes the
composer. Preserve drafts on failure. Show inherited values before submission.

| Property | New child default |
| --- | --- |
| Title | Empty; user enters it |
| Project | Copy parent; editable subject to access |
| Priority | Copy parent; editable |
| Ordinary labels | Copy parent by ID; editable |
| Task kind | One-time Task; never infer Job from the parent |
| Dates, duration, completion window | Empty/default; not copied |
| Recurrence and `vbu:*` markers | Not copied |
| Completion/progress | New incomplete task |
| Description, comments, attachments | Not copied |
| Assignees | Not copied; no new assignment feature in this scope |
| Other relations | Not copied |

Copy once at creation; later parent edits do not propagate. Automatic remembered
form values were removed; do not reintroduce them. User edits always win;
delayed loads cannot overwrite them. Attaching
an existing task changes only the relation, never its properties.

Create at most one parent per child through Better UI and prevent self-links
and cycles. Support nested children through each task's own detail page; no
global tree view. Show externally created conflicting parent relations without
silently deleting or choosing one. Block ambiguous reparenting and offer an
explicit detach-then-attach flow. Recheck relationships before writes; do not
promise cross-client atomicity unless the pinned API enforces it.

Removing the parent relation leaves both tasks intact and names both tasks in
the confirmation. Parent deletion follows existing task deletion behavior;
never cascade-delete children. Keep ordinary task lists and pagination working.

### 3. Recurrence boundary

Parent and child completion remain independent. Completion actions use existing
Task/Job rules. Children are not regenerated, reset, rescheduled or completed
when the parent renews. Relations attach to the persistent live task ID, not to
automatically generated completion-history snapshots. Snapshot description
copying must not trigger link extraction. History stays read-only in Better UI.
Verify pinned upstream completion behavior before claiming these guarantees.

### 4. Manual related tasks

Provide a Related tasks section with search by title/ID, add, navigate and remove.
Use accessible upstream tasks; paginate search. Exclude self and existing
relations. Use Vikunja's symmetric `related` relation, not mirrored comments or
two independent local records. Confirm relationship removal, not task deletion.
Show independently loaded placeholders, empty states and retryable failures.

### 5. Automatic related tasks from content

- Run after confirmed task creation/description edit and comment creation/edit
  through Better UI. Move orchestration into services; keep resolvers thin.
- Recognize supported absolute Better UI and Vikunja task URLs for configured
  trusted deployments, plus same-origin relative task paths. Normalize details,
  discussion suffixes and fragments to a task ID. Define exact paths from
  current routes and pinned upstream evidence before coding.
- Use `APP_ALLOWED_ORIGIN` for Better UI. Determine Vikunja's public frontend
  URL from trusted configuration/upstream info; its API base can be internal.
  If an additional `APP_` setting is necessary, document and validate it.
  Never trust arbitrary request Host/forwarded headers to define trusted URLs.
- Parse actual HTML links and visible plain-text URLs. Ignore code blocks,
  inline code, generated reply quotations and hidden completion metadata.
- Accept only positive task IDs, deduplicate IDs across URL forms, ignore self,
  and validate access through the configured Vikunja client. Never fetch a
  pasted URL or infer relations from arbitrary numeric text/external domains.
- Ensure the symmetric relation exists. Repeated saves and retries must not
  create duplicates. Removing a URL/comment does not remove an existing relation.
- Track newly introduced references on edits, so unrelated edits do not silently
  restore a manually removed relation. Explicit repair handles previous failures.
- Bound unique targets per save (proposed limit: 20), request time and work.
  Report excess/unresolved references instead of silently dropping them.
- Content save success survives relation failure. Return the saved resource and
  typed warnings/repair information. Retry relations without reposting comments
  or recreating tasks; revalidate persisted content and access on repair.
- If creation itself has an uncertain outcome, keep the existing reload-before-
  retry protections. Stateless operation cannot guarantee exactly-once creation
  after every network failure; do not hide that limitation.

Direct edits in Vikunja do not trigger this workflow. No webhook, polling worker,
database, historical scan, notification or automatic comment posting is added.

### 6. Emoji

Extend the Lexical editor with a
searchable picker and `:shortcode:` suggestions. Insert Unicode text, including
skin-tone and joined sequences. Store normal HTML/text compatible with Vikunja.
Do not rewrite existing text, unknown shortcodes, code or URLs automatically.
Insertion must preserve selection, undo, keyboard navigation, mobile usability
and draft recovery. Plain pasted emoji continue to work.

The comment editor integration is implemented. Description migration is approved:
preserve untouched HTML exactly, protect unsupported content from lossy editing,
and cover descriptions separately rather than relying on comment tests.

Assess existing dependencies first. A maintained emoji dataset/picker may remove
complexity; document bundle size, license and accessible integration, and obtain
dependency approval before installing it. Do not handcraft generated shadcn files.

## Architecture and evidence

Keep React -> Go GraphQL -> Vikunja API v2; Vikunja owns tasks and relations.
No application database. Enforce session/CSRF and upstream permissions.

Relevant current paths:

- `internal/service/task_kind.go`: canonical Job marker and classification.
- `internal/service/task_labels.go`: ordinary/reserved label policy.
- `frontend/src/features/tasks/visible-task-labels.ts` and
  `task-label-picker.tsx`: frontend marker policies.
- `internal/vikunja/types.go`: Task currently has no relation representation.
- `internal/service/create_workflow.go`: creation partial-success conventions.
- `internal/service/recurring_completion.go`: renewal and history snapshots.
- `internal/graphql/resolver/discussion.resolvers.go`: comment save entrypoints.
- `frontend/src/features/tasks/task-detail-page.tsx`: parent/child/related UI.
- `frontend/src/features/tasks/`: explicit last-task reuse; no automatic autofill.
- `frontend/src/features/task-discussion/editor-extension.ts`: shared rich editor.

Add focused Vikunja transport methods and typed relation summaries. Avoid recursive
full-task GraphQL relation graphs; load relation sections explicitly with bounded
results. Define additive queries/mutations and typed partial-success payloads;
do not change existing mutation return types incompatibly. Regenerate gqlgen and
frontend operations with `task gen`, never edit generated artifacts manually.

Check the exact pinned 2.5.0 API contract before implementation: relation methods,
payloads, inverse creation/removal, duplicates, permissions, response bounds,
multiple parents/cycles, deletion and recurrence side effects. Current public
documentation establishes capabilities, not verified behavior of that fixture.

## Order and verification

Follow the [task checklist](task-relationships-todo.md): pinned-contract check ->
manual relations -> subtask creation -> link automation. The marker change is done. Emoji
can follow independently once its dependency choice is settled. Each slice
includes tests and UI integration before moving to the next product capability.

Run commands only in the already-running matching Dev Container. At planning
time it is `e7c5398a3609`, workspace `/workspaces/vikunja-better-ui`; recheck before
execution. Example wrapper:

```sh
docker exec -w /workspaces/vikunja-better-ui e7c5398a3609 task validate
```

Focused checks inside that container:

```sh
go test ./internal/service ./internal/vikunja ./internal/graphql/resolver
pnpm --dir frontend exec vitest run src/features/tasks src/features/task-discussion
```

After final implementation edits: `task gen:check`, `task validate`, `task test`,
`task e2e`. The existing E2E harness uses an isolated pinned Vikunja binary inside
the Dev Container. Do not start Docker images or use production task data.

Cover API and service failure paths, form precedence, reserved labels, emoji
round trips, symmetric links, denied/missing targets, repeated saves, timeouts,
partial creation, external relation conflicts, parent/child completion and
recurrence. Browser checks cover keyboard, mobile, loading and draft preservation.

## Remaining technical gates

1. Verify pinned API behavior and token scopes; record incompatibilities before
   relying on them.
2. Emoji dependency approved: `emojibase-data@17.0.0`, MIT. Only English compact
   data and shortcodes are lazily bundled, not the full multilingual package.
3. Implemented: optional `APP_VIKUNJA_PUBLIC_URL`, defaulting to the configured
   API URL, and additive `referenceLinking` results plus `repairTaskReferences`.

### Source inspection, 2026-10-01

The pinned [frontend router](https://raw.githubusercontent.com/go-vikunja/vikunja/v2.5.0/frontend/src/router/index.ts)
defines `/tasks/:id` under its configured base path. Only Better UI supports
the additional `/discussion` and `/edit` task suffixes. HTML5 parsing uses
[`golang.org/x/net/html`](https://pkg.go.dev/golang.org/x/net/html), not regex
for element nesting. Regex only finds URL candidates inside visible text nodes.
The parser is not a sanitizer. Existing DOMPurify rendering remains the boundary
for displaying content.

Rich task creation opts into `descriptionFormat: HTML`; omission remains Markdown
for existing GraphQL callers. Pinned-fixture E2E exposed HTML loss through the
Markdown path and verifies the explicit HTML path. Editing retains untouched
original HTML; unsupported native formatting is locked against lossy edits.

The pinned [relation model](https://raw.githubusercontent.com/go-vikunja/vikunja/v2.5.0/pkg/models/task_relation.go)
creates inverse relations, rejects duplicates/self-links and checks hierarchical
cycles. These source checks do not prove single-parent enforcement or concurrent
write safety. The pinned
[task deletion implementation](https://raw.githubusercontent.com/go-vikunja/vikunja/v2.5.0/pkg/models/tasks.go)
soft-deletes the selected task. Still verify child survival and accessible
relation results with the isolated fixture before exposing these workflows.

The pinned [API v2 routes](https://raw.githubusercontent.com/go-vikunja/vikunja/v2.5.0/pkg/routes/api/v2/task_relations.go)
use `POST /tasks/{task}/relations` with `other_task_id` and `relation_kind`,
and `DELETE /tasks/{task}/relations/{relationKind}/{otherTask}`. Do not copy
the legacy PUT method from the model's v1 Swagger comment. Native permissions
require write access to the base task and read access to the target for creation;
removal requires write access to the base task. See the pinned
[permission implementation](https://raw.githubusercontent.com/go-vikunja/vikunja/v2.5.0/pkg/models/task_relation_permissions.go).

## Sources

- [Linear parent and sub-issues](https://linear.app/docs/parent-and-sub-issues):
  inline creation and property defaults; Linear does not inherit labels.
- [Vikunja task relations](https://vikunja.io/help/task-relations/): native parent,
  subtask and symmetric related relations.
- [Vikunja API v2](https://try.vikunja.io/api/v2/docs): current reference; verify
  the repository's pinned version rather than assuming current-doc parity.

The isolated fixture confirms inverse add/remove, duplicate/self/cycle rejection,
independent child completion/deletion, and native acceptance of multiple parents.
Better UI guards single-parent creation explicitly. Desktop and 320px Chromium/
WebKit tests cover create, attach, navigate and detach; emoji picker, shortcode
and Unicode save/reload passed five viewport/browser configurations. No production
migration has been performed. Full-suite results must be recorded after final edits.
