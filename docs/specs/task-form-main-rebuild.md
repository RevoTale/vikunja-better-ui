# Create and Edit rebuilt from main

## Baseline and authority

Requested 2026-11-05. Baseline is local main at bba716c (release 2.11.0).
The user actively uses that committed menu. Earlier uncommitted form experiments
are implementation material; their layout is superseded by this contract.
Implement immediately, in the stages below, as explicitly requested.
Product date semantics remain in ADR-009. Recurring renewal is governed by
ADR-001 and ADR-006.

## Goal

For user-facing explanations, start with the concrete
[scheduling examples](task-scheduling-examples.md), then explain fields.

Keep creating a quick task familiar while making broad plans, exact times,
recurrence, and ongoing work understandable. The first screen must remain useful
with just a title and the existing default project. Optional dates add no
mandatory steps to this path.

## Capability map and build order

| Stage | Scope | Depends on | Acceptance evidence |
| --- | --- | --- | --- |
| 1 | Restore main form order and direct controls | Baseline comparison | Create/Edit browser checks |
| 2 | Optional planning start and finish times | Native date contract | Service timezone tests and saved task checks |
| 3 | Compose recurring availability and timed Jobs | 2 | Native recurrence integration tests |
| 4 | Explain fields, labels and task storage | 1–3 | Preview and field-help checks |
| 5 | Verify linked views and host preview | 1–4 | Existing planning/recurring browser suites |

Existing approved implementations for Today, Active work, Revisit, periods,
Recurring, dependency upgrades, and paper surfaces are carried forward and
verified. The rejected Today nesting experiment remains withdrawn.

## Form order

1. New task keeps a two-option frequency menu near the heading, as in main.
   Use the accepted clear names Do once and Repeat. It changes the workflow
   without discarding title, description, project, labels, or typed dates.
2. Task contains title, description, project and priority, retaining main's
   basic field order and responsive one/two-column property layout.
   Schedule a timed session belongs here, below the task properties.
3. Plan contains applicable scheduling controls. One-time work starts with
   Planned finish. Recurring work starts with its first due date. Jobs use
   Start, Duration and Extra time to finish. Recurrence settings stay together.
4. Labels contains ordinary labels, with an explicit Add or create labels
   or Edit or create labels action. The label search explains both selection
   and creation. Revisit is an ordinary label.
5. Save/Create is followed by Preview Vikunja fields. Each preview row has
   an explanation. Opening it reads the current draft and makes no task write.

Task, Plan and Labels retain visible theme-aware paper surfaces, small
clickable information buttons, keyboard focus and mobile wrapping. Optional
description is expandable. Long labels and titles must not cause overflow.

## Dates and interactions

- All dates use the Vikunja user's timezone, independent of browser timezone.
- A one-time finish alone uses the server's creation instant as automatic start.
  An already-ended window retains its historical day boundary. A selected start
  takes precedence. No plan means no stored start.
- Availability is a compact sentence. Change availability opens one editor containing
  the existing calendar and an optional Add time disclosure.
- For an explicitly selected date, date-only start means midnight and date-only finish means 23:59:59.
  Optional start and finish times become native start_date and end_date.
- Picking a date takes effect immediately as the existing calendar does.
  Adding a time keeps the calendar open until Done or closing the popup.
  Opening and dismissing the editor without selecting anything changes nothing.
  Clear time returns to the date-only boundary. Use automatic start clears
  an explicit time and restores automatic availability (now on Create).
- Clearing Planned finish clears the one-time planning window and its times.
- Once a finish date is selected, show its optional time directly. A disclosure
  for this single field saves too little space to justify an additional click.
- An explicit finish must be later than start. Invalid/nonexistent/ambiguous
  wall times are rejected rather than silently adjusted.
- Deadline is independent due_date. A date-only deadline ends at 23:59:59.
  Date and time controls are directly visible for Do once; no disclosure.
  “Must be done by 12:00, overdue afterwards” needs only this deadline,
  not a planning window, duration, or Job.
  A planned finish cannot fall on a later local date than the deadline.
  Preserve the existing same-day deadline rule.
- Full Edit retains directly visible date/time fields: Available from, Planned
  finish and Deadline for one-time tasks; Start, End and Due for timed sessions.
  Shift schedule remains available. For flexible one-time work these labels explain planned
  start/end and deadline. Opening the editor or editing another property
  preserves missing dates and timestamp precision.
- Inline planning changes and the preview must respect explicit times.

## Recurrence and Jobs

- Frequency, availability and Job are composable. Job is never inferred from
  the duration of a planning window.
- A flexible repeat uses start_date for availability and due_date for its
  current occurrence. Its end_date remains empty.
- Optional recurring availability time belongs to the first start. Managed
  renewal preserves its local clock time and calendar-day distance from due.
  Date-only availability retains the existing earliest-valid-day behavior.
  An impossible future clock time must enter existing repair handling without
  renewing twice.
- A Job derives end from elapsed duration and due from elapsed completion window.
  Existing monthly restrictions and keep-time semantics remain enforced.
- Type toggles preserve drafts but only submit the active workflow's fields.
  Repeat settings must not create hidden native validation blockers for Do once.

## Views retained

- Today remains work to finish today and earlier unfinished commitments.
- Active work contains currently available work; Revisit filtering/order is optional.
- Month, Year and Custom periods remain completion views with URL-persisted filters.
- More → Recurring lists each live series once, grouped by actual frequency.
  Repeating Jobs are included. Completion history and one-time work are excluded.
- The existing task card appearance remains the baseline for these views.

## Storage, compatibility and rollback

Only additive optional GraphQL inputs are permitted for the new time controls.
Native timestamps and existing marker labels store all durable data in Vikunja.
No database or automatic migration is needed. Omitting new inputs preserves
date-only callers. Existing exact timestamps survive unrelated edits.
Front-end-only rollback can omit optional time inputs; stored timestamps remain
readable by the baseline full editor. Managed recurrence and history semantics
must stay compatible when rolling back UI changes.

## Acceptance scenarios

1. Enter a title and Create with no dates. The task remains unscheduled.
2. Plan a picnic for this month with no time. Its start/end span the chosen days.
3. Add start 12 Nov 14:00 and finish 30 Nov 15:00. Preview and Vikunja agree.
4. Clear the custom start time, then restore automatic start. No stale time is submitted.
5. Create a weekly routine available from a chosen date/time. Complete it once;
   the next availability retains the intended local time and day distance.
6. Create both a one-time Job and recurring Job with the existing duration fields.
7. Open an existing precise or partial schedule, change only its title, and save.
   Its dates retain their exact stored instants.
8. Switch Do once/Repeat/Job before saving. Inactive fields never affect the write.
9. Create/select/remove a long label on mobile. Revisit remains usable in Active work.
10. From More, open Recurring and return from task details with filters preserved.
11. Mobile WebKit and desktop keyboard navigation can open calendars, explanations,
    and previews, dismiss them, and submit without accidental creation.
12. Run focused tests, full validation, full tests and generated-code checks after
    final changes. Refresh the already authorized Mac fixture preview and distinguish
    demo verification from the real Vikunja integration checks.

## Verification record

Implemented 2026-11-05. Main's frequency placement, project/priority order and
direct Edit schedule controls are restored. Accepted planning, recurrence,
labels, paper sections and field explanations remain available.

- `task validate`: passed (strict lint, typecheck, build and quality gates).
- `task test`: passed; Go race tests with two shuffled runs, 364 frontend tests.
- `task gen:check`: passed; optional GraphQL inputs are reproducible.
- Real Vikunja 2.7 harness: 24 desktop Chromium/mobile WebKit cases passed across
  planning clocks, planning windows, full edit, recurring overview, creation
  defaults and editing. These cover clock preservation on renewal and inline
  edits, automatic start reset, exact stored dates, labels and view membership.
- The final same-day date-only validation adjustment has a focused regression
  test; the complete quality/test/generated-code checks passed after that edit.
  Both full-editor browser cases were rerun after that adjustment and passed.
- Native Mac fixture preview is available at `http://127.0.0.1:4181/tasks/new`.
  WebKit at 390px and 1440px showed no page errors or horizontal overflow.
  This fixture uses temporary demo data, separate from real-Vikunja E2E evidence.
- No commits, production deployment, database migration or production task edits.

Remaining limitation: duration of flexible work is still separate from its
availability window. No unsupported estimate field or persistence was introduced;
ordinary labels remain available for effort estimates.

## Deadline discoverability verification — 2026-11-06

`task validate`, `task test` (367 frontend tests and Go race tests),
`task gen:check`, and eight desktop / phone WebKit browser cases passed.
The deadline-only case checks native 12:00 persistence, absent start/end and
Job marker, and Overdue in Today using a past day so the check is independent
of the execution hour. Host preview passed visibility/overflow checks at
320/768/1024/1440px; mobile render inspected.

The inline planning test waits for confirmed save feedback rather than
disappearance of the Save label during a pending request. It also waits for
the login destination before initiating another navigation.

## Example review and simplification — 2026-11-06

- Independent review found that the example guide claimed Create/Edit label
  parity while describing Create only. Each example now has explicit Create
  and full Edit steps, actual field names, and the Job Apply duration step.
- Documented context-prefilled plans, preservation of existing times, and the
  fact that editing only Start does not automatically shift End/Due. Kept
  verification records separate from the workflow goal; no code refactor was
  justified for the small deadline visibility change.
- Added browser checks for editing a deadline-only task without creating a
  window and the documented 12:00–13:00 Job with a 13:30 deadline, including
  applying duration after changing its start in Edit.
- Mutation check: temporarily hiding the deadline controls caused the deadline
  visibility scenario to fail as expected; restored source before final checks.
- Final checks: `task validate`, `task test` (367 frontend tests and Go race
  tests), `task gen:check`, and 17 real-Vikunja desktop/phone browser scenarios
  passed. Coverage includes planning windows, full editing, monthly recurring
  overview, deadlines, Job duration, DST rejection, and responsive editor controls.
- Repeat independent review: no blocking findings. Flexible effort estimates
  and exact-start-only events remain unsupported as stated in the guide.

## Automatic start verification — 2026-11-06

- Create uses optional `startNow` to resolve automatic availability from server
  time at submission, to seconds. No plan, explicit dates, Edit and old clients
  retain prior behavior. Expired automatic windows keep their historical start.
- Review caught a stale-form midnight rollover; explicitness now comes only
  from the user's choice, and automatic dates are derived from the current day.
  Regression coverage includes both creation types and contextual date preservation.
- Final `task validate`, `task test` (369 frontend tests plus Go race), and
  `task gen:check` passed. Fourteen real-Vikunja desktop/phone scenarios passed,
  including server-time bounds for one-time and recurring creation and explicit
  midnight. Initial browser setup collided with a concurrent asset build;
  rerunning after the build finished passed.
- Native Safari fixture restarted with the new schema and assets. WebKit shows
  Available now and fits 320/768/1024/1440px. Independent repeat review
  found no remaining blockers. Existing recurring local-clock renewal is unchanged.

## UI vocabulary — 2026-11-06

The user approved renaming interface text only; user-defined task labels and
reserved markers remain untouched. Routes, GraphQL identifiers, native fields
and stored task titles retain their existing values.

| Earlier UI text | Current UI text |
| --- | --- |
| Available from now | Available now |
| Change start | Change availability |
| Start / End for one-time tasks in Edit | Available from / Planned finish |
| Hard deadline | Deadline |
| Job / Jobs | Timed session / Timed sessions |
| Schedule a timed session (Job) | Schedule a timed session |
| Renewal | Repeat timing |
| Scheduled cycle | Fixed schedule |
| Completion window / Time to complete after it ends | Extra time to finish |
| Organization section | Labels |

Create, full Edit, inline controls, badges, navigation, reuse actions and their
accessible names share this vocabulary. Timed session Start/End/Due labels
remain distinct from availability and planning fields. Inline type controls
use the draft type so their names update before saving. Default generated
`Job ...` titles remain unchanged because they are task data, not UI labels.

Naming verification: final `task validate`, `task test` (369 frontend tests and
Go race tests), and `task gen:check` passed. The broad desktop/phone run passed
37 cases; its remaining failure was an assertion excluding the newly accessible
Edit prefix. After correcting it to assert the full accessible name, all nine
inline/discussion cases passed, including axe and draft type-label switching.
The broader run also updated an obsolete midnight expectation to the accepted
server-time default. WebKit preview checks passed at 320/768/1024/1440px; mobile
render inspected. Independent repeat review found no blockers.
