# Weekly ledger

## Purpose

The Week view answers two questions without becoming a general calendar:

1. What active work is due on each day?
2. Which scheduled recurring occurrences are computed later in the week?

It uses day rows instead of seven narrow columns so task titles, metadata, and
completion controls remain readable on phone, tablet, and desktop.

## Navigation and boundaries

- The default view is the current Vikunja week.
- Previous and Next move by seven calendar days. Today returns to the current
  week and scrolls to today's row.
- A selected week is stored as an absolute `YYYY-MM-DD` date in the `week` URL
  query parameter. The backend normalizes it with the Vikunja user's timezone
  and configured week start.
- Selected dates are limited to ten years before or after today to keep
  recurrence expansion bounded.
- Project filtering remains URL-backed.
- Every real task appears only under the day on which it is due, including when
  that task is overdue. Tasks due outside the selected week are not shown.
- All seven days remain visible. Every day ends with a low-emphasis `Add task`
  row, including empty days.
- The current week remains chronological from its configured start. Past dates
  stay under Earlier this week, followed by Today and then future dates under
  Upcoming. A group is omitted when it is empty at a week boundary.
- Past and future weeks remain chronological from the configured week start,
  normally Monday, through all seven days.
- The Today navigation control returns from another week to the current week and
  scrolls to today's first row. In the current week it scrolls directly to that
  row. Opening or returning to the current week also scrolls to Today once after
  the rows load; background refreshes never repeat or take over the user's
  scroll position.

## Active and computed work

An active task is a real Vikunja task. It retains the normal task link,
completion behavior, metadata order, and recurrence explanation.

A computed occurrence is a read-only projection derived from a real recurring
task. It:

- uses a dashed card with secondary colors and the explicit badge `Computed`;
- links to the source recurring task;
- has no Complete, Skip, Delete, or Undo action;
- is never persisted or sent to Vikunja as a task; and
- is recalculated from fresh Vikunja data on every Week query.

Active and computed entries share one chronological order. Active tasks compare
start time first, then end time, then due time; absent values fall through to
the next available schedule time. Computed occurrences use their projected due
time. Date-only work is shown as `Anytime` without inventing a time.

## Projection rules

Scheduled-cycle day, week, and monthly recurrences are expanded after the live
occurrence into the selected week. An overdue live occurrence remains visible
exactly once under its original due-date day. Only computed due instants at or
after the current instant are shown: missed theoretical occurrences are not
backfilled, while the next interval-aligned occurrences remain visible.
Completing the overdue task then refreshes the Week view from Vikunja's
resulting live due date.

From-completion recurrence is never placed on a future day because its next
date depends on the actual completion time. An overdue From-completion task
therefore remains under its due-date day with no computed occurrence. Its active
card instead explains:

- `Next: N days after completion` for date-only recurrence;
- `Next: N calendar days after completion at HH:MM` when Keep due time is on;
  or
- `Next: exactly N hours after completion` for strict elapsed recurrence.

## Data contract

The additive GraphQL `week(input: WeekInput!): WeekView!` query returns:

- inclusive `startsOn` and `endsOn` local dates;
- exactly seven day groups containing active tasks and computed projections;
- completeness and safe upstream issue information.

The Go backend performs recurrence expansion. The browser never calls Vikunja
or calculates authoritative recurrence dates. Projection does not add a
per-task Vikunja request.

The app remains stateless and does not cache Week results. Every query uses
fresh Vikunja task pages. To limit upstream work and Go memory:

- current and past weeks request only tasks due inside that week;
- a future week requests tasks due inside that week plus recurring source tasks
  before its end, using Vikunja filters before pagination; and
- remaining pages may load concurrently, but the backend does not duplicate
  their task arrays before grouping the result.

## Accessibility and responsive behavior

- The Week view is ordinary document structure: sections, headings, lists,
  links, and buttons. It is not an ARIA spreadsheet grid.
- The seven day sections share one bordered weekly-table treatment. Current-week
  group headings remain visible as divider rows while preserving chronological
  Earlier this week, Today, and Upcoming ordering.
- Desktop day rows use a fixed date column separated from the flexible task
  column. Narrow screens stack the date heading above full-width task cards and
  require no horizontal page scrolling.
- `Add task` is the final row in each day's task column. It opens the existing
  creation flow with that local date and the selected project prefilled. The
  creation type can change without losing this context.
- The add row remains visibly labelled and keyboard accessible. Its touch target
  is at least 44 CSS pixels high on narrow screens; it does not depend on hover.
- Today uses the standard secondary Badge beside its date without changing the
  background or outline of the full day row. The date also uses
  `aria-current="date"`; Computed remains visible text in addition to its border
  treatment, and overdue real tasks retain their explicit overdue schedule text.
- The current week keeps a document heading hierarchy of page title, group and
  current-day headings, then the day headings inside Earlier this week and
  Upcoming.
- Week navigation and every task action remain keyboard accessible.
