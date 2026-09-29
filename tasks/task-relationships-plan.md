# Plan: subtasks, related tasks, emoji and namespaced Job marker

## Status and scope

2026-09-29: the namespaced Job marker is being implemented and verified separately.
Subtasks, relations and emoji remain planned, not implemented. The user explicitly
approved the breaking change from `job` to `vbu:job` and excluded data migration.

This plan uses the recommended refinement defaults: automatic linking on Better
UI saves only; Unicode emoji picker/shortcodes, without reactions; independent
parent/child completion. Copy project, priority and ordinary labels when creating
a child. Ordinary-label inheritance is a Better UI choice, not Linear parity.

Existing working-tree changes include labels, loading and discussion work.
Preserve them. These feature-specific files follow the existing `tasks/task-*-*`
convention and do not replace other plans. The marker contract here supersedes
the legacy `job` reservation in the labels plan when this change is implemented.

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
- Rollout requires explicit relabeling of existing intended Jobs, including
  completed/history Jobs. Without it they lose Job classification. Audit label
  IDs and collisions first; do not globally rename a shared label without
  checking all affected tasks. Document rollback and existing `vbu:job`
  collisions. No startup migration or production data mutation is authorized.

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

Copy once at creation; later parent edits do not propagate. Parent creation
context overrides remembered form state, including remembered title, Job mode
and dates. User edits always win; delayed loads cannot overwrite them. Attaching
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

Extend the shared Lexical editor used by descriptions and comments with a
searchable picker and `:shortcode:` suggestions. Insert Unicode text, including
skin-tone and joined sequences. Store normal HTML/text compatible with Vikunja.
Do not rewrite existing text, unknown shortcodes, code or URLs automatically.
Insertion must preserve selection, undo, keyboard navigation, mobile usability
and draft recovery. Plain pasted emoji continue to work.

Assess existing dependencies first. A maintained emoji dataset/picker may remove
complexity; document bundle size, license and accessible integration, and obtain
dependency approval before installing it. Do not handcraft generated shadcn files.

## Architecture and evidence

Keep React -> Go GraphQL -> Vikunja API v2; Vikunja owns tasks and relations.
No application database. Enforce session/CSRF and upstream permissions.

Relevant current paths:

- `internal/service/task_kind.go`: legacy Job marker and classification.
- `internal/service/task_labels.go`: ordinary/reserved label policy.
- `frontend/src/features/tasks/visible-task-labels.ts` and
  `task-label-picker.tsx`: frontend marker policies.
- `internal/vikunja/types.go`: Task currently has no relation representation.
- `internal/service/create_workflow.go`: creation partial-success conventions.
- `internal/service/recurring_completion.go`: renewal and history snapshots.
- `internal/graphql/resolver/discussion.resolvers.go`: comment save entrypoints.
- `frontend/src/features/tasks/task-detail-page.tsx`: parent/child/related UI.
- `frontend/src/features/tasks/autofill/`: remembered creation values.
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
marker change -> manual relations -> subtask creation -> link automation. Emoji
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
2. Select emoji data/picker and request approval if a dependency is needed.
3. Determine public Vikunja URL configuration and additive partial-success API.
4. Review the legacy-label inventory/runbook before deployment; no data migration
   is performed by this planning task.

## Sources

- [Linear parent and sub-issues](https://linear.app/docs/parent-and-sub-issues):
  inline creation and property defaults; Linear does not inherit labels.
- [Vikunja task relations](https://vikunja.io/help/task-relations/): native parent,
  subtask and symmetric related relations.
- [Vikunja API v2](https://try.vikunja.io/api/v2/docs): current reference; verify
  the repository's pinned version rather than assuming current-doc parity.

No implementation, runtime qualification, dependency installation or production
migration has been performed as part of this plan.
