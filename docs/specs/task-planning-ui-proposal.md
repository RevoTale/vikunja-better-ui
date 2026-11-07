# Planning windows and active work

Implemented on 2026-11-03. The accepted date semantics are in
[ADR-009](../decisions/0009-task-planning-windows.md).

Start with [concrete scheduling examples](task-scheduling-examples.md): user
intention, form choices, visible behavior, then native field mapping. In particular,
“done by 12:00, overdue afterwards” uses the directly visible Deadline date
and time. No duration or planning window is required.

## Choosing a period

### Create task contract

Frequency and availability are independent. Choose **Do once** or **Repeat**,
with an automatic or explicitly chosen start. A timed session uses its own
start time and duration. Only the inputs for the selected workflow apply.

| Plan | Dates stored in Vikunja | What happens on completion |
| --- | --- | --- |
| Do once | Optional window in `start_date` and `end_date`, independent optional `due_date` | The task finishes once |
| Repeat | First occurrence's availability in `start_date`, first due date and optional time in `due_date` | Vikunja renews the same task. Each new occurrence keeps the original number of local calendar days between start and due |
| Timed session, once or repeating | Exact start, end from duration, deadline from completion window | Existing Job rules apply |

For a flexible repeat, the first due date is the renewal anchor. Automatic
availability uses the server creation instant; an already-ended first occurrence
retains its historical day boundary. Explicit calendar/context dates retain their
selected date and default to midnight without a time. Existing renewal preserves
the initial local clock and calendar-day gap. Edit never resets availability to now.
An explicit start cannot fall after its due day. Active work uses the start
and due instants when a managed repeat has no planned end. Today continues
to use the due date for recurring work. Dates, labels, and recurrence settings
live in Vikunja. A private `vbu:recurring-availability` label identifies
managed day-based availability. Clients omitting availability retain existing
behavior. No existing task needs migration. Flexible repeats have one due
anchor and no separate planned end in this form. Switching a managed repeat
to a Job or an exact interval in Edit removes its availability marker.

Renewal preserves the original local start clock, including an automatic
creation-time start. A start at the beginning of its day uses the earliest
valid instant of the new start day. If a timezone skips an entire civil date,
it uses the next real date. Subsequent windows
use the dates actually stored in Vikunja. A target outside the supported
date range after native renewal requires manual reconciliation.

Vikunja 2.7 advances dates independently for scheduled repeats, uses monthly
calendar arithmetic for monthly repeats and anchors from-completion repeats to
the completion instant. Better UI derives the next local start from the final
due day, including after a late completion or Skip. A checked repair must not
renew the task twice. [Upstream renewal implementation](https://github.com/go-vikunja/vikunja/blob/v2.7.0/pkg/models/tasks.go#L1710-L1877)

New task and full Edit share three sections. **Task** contains the title
and an **Add description** disclosure, then project, priority and **Schedule a timed session**. An existing description opens on
edit. Frequency stays above the sections, as in main. **Plan** contains dates, timed session fields and
schedule adjustments. Each section has its own paper-colored surface in both themes.
The small info button beside each section title opens its explanation.
**Labels** shows selected labels as chips. **Add or create labels** or **Edit or create labels**
opens the picker. Typing a name offers to create that label or select an
existing match. Save is available below the sections.

At the bottom of New task and full Edit, **Preview Vikunja fields** reads the current draft
without saving. It shows the date boundaries, deadline, recurrence values,
ordinary label IDs, workflow markers, and editable task properties. Each field
has a question mark explaining its value. Reopen the preview after further edits.

On New task, choose **Do once** and select **Planned finish**. The optional **Planned finish time** field appears directly below the date, without a disclosure. Leaving the time empty includes the entire finish day. A future
finish makes the task available from today in the Vikunja user's timezone.
A finish in the past defaults to a one-day plan on that date. The availability row shows the effective date. **Change availability** opens the calendar directly. Selecting a day overrides the automatic start. **Use automatic start** restores the default. Clearing the finish clears the plan.
Leaving the plan empty creates an unscheduled task unless a deadline is set.
An ordinary label such as `1h` can record estimated effort separately.

**Repeat** opens the interval, unit and renewal controls. Choosing Months sets
the supported one-month scheduled cycle. A sentence previews the rule.
**Schedule a timed session** adds a start time, duration and completion window.

Full Edit keeps the main Start, End and Due date/time controls directly visible. Inline Planning preserves clock times while changing dates. Save applies the draft; Cancel discards it. Full Edit and inline Type share the **Do once / Repeat** choice.
A day selected in the weekly ledger or day navigation initializes a one-day
plan. The optional Deadline has its own control.

The app stores the inclusive local range in Vikunja's native start and end
timestamps. A two-hour picnic planned for November can run on any available
day from November 1 through 30. Its two-hour estimate can go in the description.
A deadline may be on or after the planned finish day and retains its exact
time. Editing another property preserves existing timestamp precision, even
when an imported task starts and finishes within the same minute.
In the full editor, set exact Start/End times directly. **Shift schedule** can also move a deadline-only task. Moving
the deadline before the planned finish day displays an error before saving.

## Finding work

| Destination | Unfinished tasks shown |
| --- | --- |
| Today | One-time planned finishes and deadlines today. Earlier unfinished work appears under Needs attention. |
| Active work | Work whose window contains now, including managed repeats through their due time. Earliest ending windows come first by default. |
| More → This month / This year | Tasks with a planned finish or deadline in the selected calendar period, including earlier unfinished backlog for the current period. |
| More → Custom period | The same completion list with explicit inclusive From and Through dates. Past or future periods show only matching dates. |
| Week | The existing daily ledger, including one-time planned finishes and due-based recurring projections. |

For the November picnic, Active work offers a place to return to it during
the month. It appears in November's completion list and enters Today on
November 30 if still open. Completing it removes it from all unfinished lists.
Working on it for one session requires no status change.

### Ordering Active work

Use the ordinary Vikunja label **Revisit** for work that needs another session
or an occasional check-in. Choose **Revisit** in **Filter by label** to show
only those tasks. Turn on **Revisit first** to put them above the other active
tasks, including when filtering by another label or project.
If two labels are both named **Revisit**, either one puts a task in the first
group. Filtering by label still selects one specific label ID. A lowercase
**revisit** is a distinct title.

Sort by start or planned finish in either direction, or by label from A to Z
or Z to A. A task with several visible labels sorts by its alphabetically
first label, ignoring case. Tasks without visible labels come last in either
direction within each group. Ties use the usual planned-finish order. Changes
apply to the whole result before pagination and are preserved in the Active
work URL. The default is earliest planned finish first.

The Today badge uses the same membership rules as the Today list. A task that
matches both dates appears once. Missed plan and Overdue distinguish an earlier
planned finish from a missed deadline. Jobs and recurring tasks keep their
existing completion and renewal rules.

Today shows its completion message only for an empty, unfiltered list. An
empty filtered list identifies the active filters as the reason. If completing
tasks empties the last page while others remain, **Show remaining tasks** opens
the last available page with the same filters.

## Navigation and layout

Active work is beside Today and Week in the desktop sidebar. The mobile bar
shows Today, Week, Active and More. Each view reuses the existing task card.
The period page supports week, month, year and custom ranges with project,
label and priority filters. Its URL carries the selection across navigation
and reloads. **Finish in period** carries the current Active work filters into
the period view. Saved named filters remain deferred.

## Verification

Service and resolver tests cover native date boundaries, timezone transitions,
deadlines, list membership and week/day behavior. Browser coverage exercises
creating a plan, finding it in Active work and a custom period, editing its
finish, and completing it in Today.

### Active work total

The title includes the total matching active tasks across all pages. Filters
change the count; sorting and pagination do not. Use `tasks.totalItems` only
from a complete successful result. Loading reserves badge space; failures show
an unavailable indicator rather than a misleading zero.

Verified 2026-11-07: focused count tests, `task validate`, and `task test`
passed (374 frontend tests plus Go suites). WebKit preview shows the count at
320px and 1440px without horizontal overflow. Preview assets refreshed.
