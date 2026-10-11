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
- Completion uses the existing workflow, including renewal and Undo
  rules. Completed/skipped history cannot be reopened through inline editing.

## Task workspace UX

Complete is the visible primary action, not a hidden status-picker action. It
completes a task or, explicitly, one recurring occurrence. Keep existing Undo
rules. Derived status stays readable in Properties, not a pretend editable field.
Edit and Skip remain visible; Extended and Delete live in the keyboard-accessible
more menu. Delete still navigates to its confirmation page.
Complete, Skip, Undo and repair share the inline editor's action lock, so slow
requests cannot overlap another transition or overwrite an active field draft.

The title edits in place with a pencil affordance. Description has a visible Edit
action and selectable, readable-width content: no invisible edit overlay
intercepts selecting text or clicking links. Explicit Save/Cancel and matching
rich formatting remain. On desktop Properties occupies a separate side column;
on phones content comes first, then Properties, Relationships and Discussion. Group schedule
fields separately, preserve editable empty values and match the loading skeleton.

The separate Discussion page remains reachable from the Discussion heading.
Recurring tasks explain that discussion belongs to the whole series. Completed
details explain read-only fields without disabling the discussion itself.
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
