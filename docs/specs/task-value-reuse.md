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
valid Job duration/completion-window values, and nullable due/start local dates
and times in the token owner's timezone. Each field has an explicit reuse
button. Descriptions and recurrence rules are never copied.
Loading, errors, and type changes never write form state. Buttons are disabled
until a fresh response for the selected combination is ready. Clicking changes
only the selected field; label reuse adds missing labels without removing
current selections. Pending label creation disables label reuse.

Schedule buttons reuse one exact field at a time, at minute precision, without
changing its paired date/time or other fields. Dates may be in the past; do not
rebase them to today. Hide the synthetic 23:59:59 time of a `vbu:date-only`
deadline. Missing values disable the relevant button. One-time due time reuse
requires a selected due date. This extends the existing query without adding
upstream calls, browser storage, auto-application or per-field history scans.

The global New task action carries valid project and ordinary label IDs from
supported list filters, plus the selected Today date. Today, Long term and Jobs
also carry a selected priority, including `UNSET` (No priority); omitting
priority means All priorities and normal creation defaults. Future Today
per-day Add task actions carry the same filters. Weekly per-day actions retain
their explicit date/project, without importing priority. Filter context initializes a new form once;
background metadata reads never remount it or overwrite current values. Resolve
initial label IDs against accessible ordinary labels before showing editable
controls; metadata refreshes thereafter do not restore deselected labels.

No task values are persisted in browser storage. Discussion drafts are unchanged.
Verify all four combinations, creator filtering, ordering, history exclusion,
internal-label exclusion, empty/error responses, delayed responses, and manual
field isolation on desktop and mobile. Run generation, validation, unit/race
tests, and focused real-fixture E2E after implementation.
