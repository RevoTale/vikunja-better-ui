# Manual task value reuse

Creation starts with normal defaults, never automatic recall. Job is selected
above the editable fields. Suggestions come from the newest accessible task
created by the configured Vikunja token owner, ordered by creation time and ID
descending, separately for Job/non-Job and recurring/one-time. Completion
history snapshots and invalid metadata are excluded; completed ordinary tasks
remain eligible. This is not the app login identity.

Vikunja 2.5.0 supports creator/label filters and creation sorting but not
`repeat_mode` filtering. The service reads bounded pages and checks recurrence
until the first eligible task, including monthly tasks with `repeat_after=0`.
It does not accumulate the user's tasks in memory.

A read-only GraphQL query supplies title, project, priority, ordinary labels,
and valid Job duration/completion-window values. Each field has an explicit
reuse button. No dates, times, descriptions, or recurrence rules are copied.
Loading, errors, and type changes never write form state. Buttons are disabled
until a fresh response for the selected combination is ready. Clicking changes
only the selected field; label reuse adds missing labels without removing
current selections. Pending label creation disables label reuse.

No task values are persisted in browser storage. Discussion drafts are unchanged.
Verify all four combinations, creator filtering, ordering, history exclusion,
internal-label exclusion, empty/error responses, delayed responses, and manual
field isolation on desktop and mobile. Run generation, validation, unit/race
tests, and focused real-fixture E2E after implementation.
