# Task editing and schedule controls

Approved scope: remove Month navigation (redirect old links to Week), edit
existing active tasks, Reset autosave, relative schedule adjustments, and a
reusable duration input. Recurring edits affect the live task and future
projections only. Completed history remains read-only.

## Implementation

1. Compose a duration input from existing shadcn wrappers; keep canonical whole
   minutes in forms and the API. Units are minutes, hours, days (24 hours).
2. Reset the entire creation form to route-aware defaults without reading
   remembered values again during this form session. Persistent memory remains
   until another successful creation replaces it.
3. Remove Month from both navigation layouts and redirect old URLs to Week.
4. Add an authenticated, CSRF-protected update mutation using checked JSON Patch.
   Validate schedule and recurrence before writes. Reject stale versions and
   completed/history tasks. Preserve fields outside this app's editable scope.
5. Add an edit form independent of creation autofill, with date/time controls,
   duration controls and previewable relative shifts of one date or all dates.
6. Cover conversion, reset collisions, stale edits, recurrence, timezone/date
   boundaries, failures, and real browser flows. Run full project gates, review,
   and simplify after the final change.

Existing tasks/plan.md and tasks/todo.md belong to earlier work and are preserved.

## Verification

All commands run in the existing Dev Container: focused Vitest/Go tests, task
gen, task gen:check, task validate, task test, task e2e. No commits or pushes.
