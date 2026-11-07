# ADR-009: Separate planning windows from deadlines and work effort

## Status

Accepted product semantics on 2026-11-02. Planning windows and completion/active
views implemented on 2026-11-03; saved named filters remain deferred.

This decision replaces the due-only planning direction in the original
[product idea](../ideas/recurring-task-client.md) and
[MVP specification](../specs/mvp.md). The implementation contract is recorded in
[planning UI](../specs/task-planning-ui-proposal.md). No existing task data is
migrated. Recurrence rules and the Jobs integration contract remain unchanged.

The separate [Today time-window presentation](../specs/today-time-windows.md)
experiment was rejected and rolled back on 2026-11-03. This planning decision
remains accepted. Completion-view filtering is implemented; custom-view
persistence has not been implemented.

## Date

2026-11-02.

## Context

The user needs to manage small one-time tasks and work completed over many
sessions in the same application. Some tasks can be completed at any point
within a week, month, year, or custom period. Today should contain work intended
to be finished by the end of today, while longer-running work remains easy to
revisit without requiring its completion every day.

Before this change, Today and the list-based Week/Month scopes filtered by `due_date`.
Long term includes tasks without a deadline or with a deadline more than seven
days away. The separate weekly ledger groups work by its due day. These views
do not express a planning window independently of a deadline.

Jobs already store a start, planned end, and completion deadline in Vikunja.
The application must remain stateless and must not invent upstream fields.

## Decision

### One meaning for each date

Use the existing Vikunja fields consistently across task contexts:

| Field | Meaning |
| --- | --- |
| `start_date` | Beginning of the planned work window |
| `end_date` | Planned completion |
| `due_date` | Hard completion deadline, when one exists |
| `done` | The task's complete result has been achieved |

The interval from start to end is the available planned window. It is not an
estimate of effort, time spent, or a record of actual work. A short continuous
session is a narrow window; a task that can be done anytime in November has a
month-wide window. The fields do not change meaning between these cases.

Day, week, month, and year choices are shortcuts for setting dates. Do not store
a separate planning unit or add `vbu:plan:*` labels. Do not infer a task type from
the number of days between its dates. Reminders remain notifications and do not
define a planning boundary. The gap between end and due is deadline buffer,
not the task's planning horizon.

### Completion views and available work

Provide two distinct ways to inspect the same unfinished tasks:

- **Finish within a period:** Today, Week, Month, Year, or a custom period show
  tasks whose planned completion falls within that period. A hard deadline in
  the period also makes a task relevant, including tasks with no planned end.
  Show each task once even when both dates match.
- **Active work:** show tasks whose planned work window includes the present.
  This view supports returning to ongoing work; it need not be empty each day.

Current-period completion views retain earlier unfinished plans visibly as a
separate backlog. Distinguish a missed planned end from an overdue hard deadline.
Do not silently move dates forward, complete tasks, or hide unfinished work when
a period ends. Missing dates do not count as dates in the past.

Completion views overlap: a task planned for today can also appear in the
current Month and Year views. These are views of one task, not copies or
mutually exclusive categories. Reaching the start date alone does not put a
month-wide task in Today. Reaching its planned completion day does.

Calendar periods use the Vikunja user's timezone and configured week start.
A period ending on November 30 includes that full local calendar day. Exact
timestamp encoding and date-only presentation require an implementation spec.

### Examples

A picnic planned for November has start November 1, end November 30, and no
mandatory deadline. On November 10 it is available in Active work and Month,
but does not need to be completed that day. If still unfinished, it belongs in
Today on November 30 and remains visible afterward as a missed plan.

Once the user chooses November 15, 14:00-16:00, replacing the broad window with
that interval makes it a plan for November 15. The task identity and meanings
of its dates stay the same. This replaces the broad plan rather than storing
both windows on one task.

A website planned for November uses the same model. Work can span any number
of sessions without completing the task after each session. Subtasks may help
but are not required by this decision.

### Jobs and effort

Preserve the existing Job calculations:

```text
end_date = start_date + duration
due_date = end_date + completion window
```

For a Job, duration sizes a concrete scheduled interval. For flexible work,
window length does not measure effort. A month-wide picnic window cannot also
encode a two-hour effort estimate in the same pair of dates. Such an estimate
can remain in the description; no structured effort field or work-session
storage is approved here.

Keep the existing required Job fields and recurrence normalization described in
[ADR-006](0006-recurring-jobs-use-native-renewal.md). A generic task with start
and end but no deadline is not automatically a Job. Narrowing a planning window
does not implicitly enable Job mode.

### Custom views

A custom tab represents a named filter, not a new task category. It may select
planned completions within a period or work windows overlapping a period, with
optional project, label, and priority constraints.

Use native Vikunja Saved Filters as the intended persistence mechanism for
these views, subject to API-version and token-access verification. The current
client has no Saved Filters integration. Do not add an application database or
silently substitute another storage mechanism if verification fails.

## Alternatives considered

- **Planning-unit labels:** rejected because the chosen design needs date-based
  views, not independently stored day/week/month/year task categories.
- **Classify by window length:** rejected because length does not express
  effort, number of sessions, or the period selected for viewing.
- **Use reminders or the end-to-due gap as the window:** rejected because
  notifications and deadline buffer have different meanings.
- **Use due dates for every plan:** rejected because a planned completion and
  a hard deadline must remain distinguishable.
- **Require subtasks for all multi-session work:** rejected because returning
  to a task does not require decomposing it first.

## Consequences

- Both small tasks and long-running work use the same upstream date fields.
- List filtering must change; renaming tabs alone cannot implement this model.
- Month-wide work enters Today on its planned last day if unfinished.
- No automatic migration of existing dates is authorized by this decision.
- Recurrence, completion, Skip, Undo, and existing Job schedule calculations
  remain governed by their current contracts.

## Implementation resolution — 2026-11-03

Date-only one-time planning windows use local 00:00:00 through 23:59:59, with
strict date and timezone validation. Presets derive dates using the user's week
start. A new window requires both boundaries. Clearing it clears both; unchanged
timed/partial legacy schedules retain their precision. A changed plan/deadline
cannot put the planned finish on a later calendar day than its hard deadline.

Today includes one-time planned ends as well as all due dates, with older work
in Needs attention and distinct Missed plan/Overdue presentation. The additive
`todayTaskCount` follows that policy; the existing `actionableTaskCount` API is
unchanged. Active work selects valid bounded windows containing now. The weekly
ledger/day queries include one-time planned finishes once within their range;
recurring projections and Jobs remain due-based.

Users can mark work they want to return to with the ordinary Vikunja label
`Revisit`. Active work recognizes that exact title across label IDs for the
optional **Revisit first** ordering. The existing ordinary-label filter uses
the selected label ID. Active membership and Today continue to depend on dates.

More links to current month, current year and a custom completion period using
the new `PERIOD` scope. A range containing today retains earlier unfinished
backlog; other ranges do not. Selection and filters live in the URL, not in
application storage. Lists refresh once per minute while visible.

## Creation form decision — 2026-11-04

For a new flexible task, choosing a finish date is sufficient to submit a
complete native window. Default its start to the earlier of today in the
user's timezone and the selected finish. An explicit start or a day selected
in the ledger takes precedence. Clearing the finish removes both boundaries.
The hard deadline is optional and separate.

## Flexible recurring availability

Flexible recurrence now accepts an independent availability date. An ordinary
repeating task created with that date stores it at local midnight in
`start_date`, leaves `end_date` empty, and uses its required `due_date` as the
last available instant. The exact internal `vbu:recurring-availability` marker
opts that task into calendar-day start normalization after native renewal.
Existing unmarked schedules retain their original semantics. See the
[creation matrix](../specs/task-planning-ui-proposal.md#create-task-contract).

## Planning form clarifications — 2026-11-05

1. **Setting a finish should be enough.** The user usually knows when to
   finish and rarely delays the start. New task accepts a concrete date
   without requiring a day/week/month preset. Selecting November 30 on
   November 5 defaults the start to November 5. A backdated finish uses its
   own day as the automatic start.
2. **Show availability in one line.** The earlier “When can you start?”
   switch made the default look like a decision required on every task.
   Show “Available from today” or the effective date. “Change start date”
   opens the calendar directly. Selecting November 12 pins that start;
   “Use automatic start” restores the derived date. Opening and cancelling
   the calendar must preserve the draft. An unscheduled task stays unscheduled
   until dates are entered. An imported finish-only task keeps its absent start.
3. **An exact finish belongs in creation too.** A person can plan to finish
   at 15:00 without scheduling a Job or setting a hard deadline. For a one-time
   plan, the optional finish time sets local `end_date`. Without a time it
   ends at 23:59:59. Neither choice sets `due_date`.
4. **Explain the mapping where the user makes the decision.** Users want to
   understand the result before creating or editing a task. Both forms show
   a preview at the bottom with a question mark beside each field. Opening it
   reads the current draft without submitting it.
5. **Make form controls discoverable.** Users could not tell how to add or edit
   labels. Organization names both actions explicitly. Task, Plan, and
   Organization each have a visible paper surface and an on-demand explanation.
   Dropdown triggers and disclosure headings suppress accidental text selection.

6. **Choose Job in Task.** On New task and full Edit, place **Schedule a timed
   session (Job)** below the description. This keeps the choice of task type
   together with the task itself. Its schedule is configured in **Plan**.

The [planning form specification](../specs/task-planning-ui-proposal.md#create-task-contract)
describes the current controls for one-time, recurring, and timed work.

## Deferred

- Verify Saved Filters operations and relative-date/null handling against the
  supported Vikunja API version and configured API-token permissions. Existing
  documentation examples alone are not an integration test.

## References

- [Vikunja dates and reminders](https://vikunja.io/help/dates-and-reminders/)
- [Vikunja Saved Filters](https://vikunja.io/help/saved-filters/)
- [Vikunja filter API](https://vikunja.io/docs/filters/)
- [Current list policy](../../internal/service/task_list.go)
- [Current Job creation](../../internal/service/task_creation.go)
- [Current weekly ledger](../specs/weekly-ledger.md)

## Main-based form rebuild — 2026-11-05

- The user clarified that “current Create/Edit” means committed main, used daily.
  They authorized a detailed specification followed immediately by implementation.
- Restore that menu's frequency placement, task property order and visible full
  editor date/time controls. Reapply agreed features incrementally on this base.
- Date-only availability was too restrictive. Add an optional start time while
  preserving the quick date-only path and automatic start.
- Optional GraphQL `startsAtTime` and `availableFromTime` write native
  `start_date`; no new durable storage is introduced. A managed repeating task
  retains its local availability clock and calendar-day gap on renewal.
- Inline planning date edits preserve existing start/end clocks. Restoring
  automatic start explicitly clears the start clock. Full Edit keeps independent
  boundaries and preserves timestamps on unrelated edits.
- This supersedes the earlier preview layout where project and priority followed
  Plan and exact editing required an additional disclosure.
- The implementation and acceptance contract is
  [the main-based rebuild specification](../specs/task-form-main-rebuild.md).

## Small controls stay visible — 2026-11-05

- User rejected the finish-time disclosure: it hides only one small field and
  adds an unnecessary action. Show the optional field directly after selecting
  the finish date. Native date semantics remain unchanged.
- General rule: avoid dropdowns/disclosures when the space saved is negligible.
  Prefer direct controls for small amounts of content. Recorded in AGENTS.md
  so future changes preserve this preference.
- Verified with `task validate`, `task test` (364 frontend tests and Go race
  tests), 12 desktop/mobile browser scenarios, and WebKit layout checks at
  320/768/1024/1440px. Safari fixture preview assets were refreshed.

## Independent reminders — 2026-11-05

- The user requested reminder creation/editing after clarifying that reminders
  do not define availability or task type. Keep reminder delivery independent
  from start/end/due semantics and Today/Active filters.
- Use Vikunja's native reminders array. Share direct date/time rows between
  Create and full Edit; preserve imported relative rules and untouched seconds.
- Existing relative rules can be removed or explicitly converted to specific
  time. New relative-rule controls are outside this small UI addition.
- Perform review → fixes → simplification → final tests as explicitly requested.
  Contract and evidence: [Task reminders](../specs/task-reminders.md).

## Explain intentions through examples — 2026-11-06

- The user clarified “go to the shop at 12:00”: it must already be done by
  12:00 and be overdue afterwards. This is a native `due_date` deadline,
  not `start_date` availability and not a Job requiring duration.
- Correct the earlier conversational claim that this example was unsupported.
  The existing deadline workflow supports it. Do not add another scheduling
  type or reinterpret start/end fields for this accepted scenario.
- Make one-time deadline date/time directly visible in Create instead of
  hiding two fields under Add a hard deadline. Explain overdue behavior in
  Create/Edit. Existing data, recurrence, APIs and completion rules stay intact.
- The user requested durable, example-led explanations to avoid repeating this
  confusion. Use intention → form choices → observable behavior → native fields.
  Include limitations explicitly, especially effort estimates inside a window
  and an exact start without duration that is not a deadline.
- Current examples: [Scheduling examples](../specs/task-scheduling-examples.md).

## Automatic availability means now — 2026-11-06

- User explicitly chose the current moment instead of midnight for automatic
  availability. Resolve it on the server during Create, to second precision;
  leaving a form open must not freeze the start at form-opening time.
- This supersedes automatic midnight for a new one-time planning window and
  the first flexible recurring occurrence. No plan still means no start.
- Explicit calendar/context dates and explicit times retain existing semantics.
  Date without time means midnight. If the automatic window already ended,
  retain its historical start instead of writing a start after its finish.
- Add optional GraphQL `startNow` (default false) to the two create inputs.
  Store only native `start_date`, no new Vikunja fields or persistence.
  Old callers, Edit, Jobs and existing tasks are unchanged. Renewal keeps the
  existing local-clock/day-gap rules, including the initial automatic clock.
- Create says Available from now and field preview explains server resolution.

## Consistent interface terminology — 2026-11-06

- User approved clearer UI names only. Do not rename user-defined labels or
  reserved `vbu:*` markers. Keep API identifiers, routes and task data unchanged.
- Use Available now, Change availability, Deadline, Timed session(s), Repeat
  timing, Fixed schedule, Extra time to finish, and Labels (section title).
- Full/inline editing of one-time tasks uses Available from and Planned finish
  rather than ambiguous Start/End. Timed sessions retain Start/End/Due because
  they describe the actual interval and its completion deadline.
- Preserve Planned finish, Missed plan and Overdue as distinct concepts.
  Update current examples and accessible control names with visible labels.
- Generated default task titles remain stored task data (including existing Job
  titles); this presentation-only change does not rename or migrate any task.

## Relative reminders first — 2026-11-07

- User wants quick relative reminders in Create/Edit: 2 hours before or 1 day
  before, with specific date/time available. This supersedes the original
  absolute-only creation scope, to reduce repeated calendar setup.
- Add reminder defaults to 2 hours before the deadline, otherwise planned
  finish, otherwise availability. Timed sessions prefer session start.
- Show the selected event explicitly; users can choose another available event.
  Never silently change an existing reminder's anchor when the plan changes.
- Without a task date, offer an absolute reminder and explain the requirement.
  Removing an anchor leaves its native rule inactive, visibly explained.
- Store native `relative_to` and signed `relative_period` seconds. Existing
  absolute instants and arbitrary relative offsets survive unrelated edits.
- Example: deadline 18:00 + 2 hours before → reminder 16:00; moving deadline
  to 19:00 moves reminder to 17:00. No task dates or Today filters change.
- Current contract: [Task reminders](../specs/task-reminders.md).

## Active work total — 2026-11-07

- User requested a total count in Active work. Show it beside the page title.
- Count all matching tasks across pagination, using the existing GraphQL
  `tasks.totalItems`; project, label and priority filters apply to the count.
- Show a placeholder while loading and an unavailable indicator on failure or
  incomplete results. Zero appears only after a successful empty response.
- No additional request, native field or persistence is needed.
