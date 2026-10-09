# Inline task editing

The task page is also an editor. Active tasks expose title and description editing
in place, and property controls beside their displayed values. Completed history
remains read-only. Timezone and Overdue are derived values, not arbitrary statuses.

## Interaction contract

- Click the title or the description's Edit action to start editing in the same
  position. Preserve title typography and the description's rich-text styles.
- Title: Enter saves, Escape cancels. Description: explicit Save/Cancel; entering
  a newline never submits. No save on blur or background replacement of a draft.
- Priority, project, labels, type/recurrence and dates open compact Base UI popovers.
  Save confirms the change; Cancel or dismissal discards that field's draft.
- Empty labels and dates remain editable. Dates use the Vikunja timezone and the
  existing date/time controls. Job/type controls include the whole schedule because
  those fields must remain valid together.
- Status offers the existing completion workflow, including renewal and Undo
  rules. Completed/skipped history cannot be reopened through inline editing.
- Only one inline editor is active. Prevent duplicate requests. Preserve the
  snapshot version and untouched fields; conflicts/uncertain saves keep the draft
  and require an explicit reload before another submission.
- Preserve exact description HTML until edited. Unsupported content remains
  viewable and directs users to native Vikunja instead of silently losing it.
- Use existing GraphQL mutations/session/CSRF protection; no new persistence,
  dependencies or incompatible API changes.

## Implementation and verification

Keep shared save handling, field controls and content editing in separate task
feature modules. Reuse application wrappers; generated shadcn remains untouched.
Implement save snapshot tests first, then title/description and property editors,
then real-browser tests for keyboard, formatting, cancellation, conflict and
mobile overflow. Run focused tests, `task gen:check`, `task validate`, `task test`
and `task e2e` through the running Dev Container after the final changes.
