# Task labels and list filtering

## Scope

Select existing labels and create labels in new-task and edit-task forms. Add a
single inclusion-only label filter to Today and No date. IDs identify labels;
titles are display text. Internal `vbu:job` and `vbu:*` labels are never selectable,
creatable, removable, or filterable through these controls.

## Design

- Reuse Vikunja 2.5.0 API v2 through authenticated GraphQL. No dependencies,
  persistence, exclusion filters, or recurrence semantic changes.
- Validate selected IDs before task writes. Preserve internal markers. Optional
  edit label IDs preserve existing labels when omitted; an empty list clears
  only ordinary labels. Read-only History stays read-only.
- Creating a label is a separate explicit action. Reuse an exact existing title
  on retry; existing duplicate titles remain distinguishable by ID. A created
  label stays in Vikunja even if task creation is abandoned.
- Task creation must return the created task if label attachment fails, with
  actionable feedback instead of inviting duplicate task creation. Edit failures
  use the existing uncertain-save/reload protection.
- Apply the filter upstream where compatible, before app pagination; retain a
  defensive local ID check, particularly with No date null-date filtering.
- Store the filter in URL search, reset page on filter/project changes, preserve
  it through pagination and task return links. Do not include labels in autosave.
- Use accessible existing shadcn wrappers and native form semantics. Load label
  options independently; never replace typed text or selections after a read.

## Ordered slices

1. Protected-label policy, label query/create contract and tests.
2. Task create/edit label assignment with partial-failure tests.
3. Shared form picker, new-label creation, reset and error behavior.
4. Today/No date URL filter and server-side filtering tests.
5. Responsive real-fixture E2E, documentation, review and simplification.

## Verification

Focused Go/Vitest tests after each slice; real Vikunja E2E for create, edit,
filter, duplicate names, hidden markers and return navigation. Finish with
`task gen:check`, `task validate`, `task test`, and `task e2e` in the running
Dev Container. Preserve unrelated changes. Do not commit or push.
