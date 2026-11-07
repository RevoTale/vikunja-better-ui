# Task reminders

Requested 2026-11-05; implement add/edit reminders, then review and simplify.

## Contract

- Reminders are independent of availability, planned finish, hard deadline and
  Today/Active membership. They do not reserve working time.
- Create and full Edit offer Add reminder in Plan. Each added reminder shows
  2 hours before by default when a task date exists, with visible 2 hours /
  1 day presets and an explicit event choice. Specific date/time remains available.
  No dropdown hides a single field.
- Resolve edited date/time in the Vikunja user's timezone, rejecting nonexistent
  and ambiguous DST times. Preserve untouched timestamps, including seconds.
- Existing relative reminders retain their native anchor and offset. Display
  their rule; allow removal or explicit replacement with a date/time.
- New relative reminders prefer deadline, then planned finish, then availability;
  timed sessions prefer session start. Without an anchor, default to specific
  date/time and explain why. Existing rules are never silently retargeted.
- Native `reminders` arrays are the sole durable storage. Nil input means
  preserve; explicit empty array clears. Additive GraphQL input/output only.
- Keep task version/conflict checks and confirm the saved reminder set after edit.
  Vikunja sorts and deduplicates by second; reject colliding requested reminders.
- Recurring tasks use native renewal of reminders. Relative reminders recalculate
  when dates change. Absolute reminders follow the native recurrence algorithm,
  not a custom offset from due. History snapshots remain reminder-free.
- Delivery depends on Vikunja notification settings. This app does not schedule
  its own notifications or promise browser push delivery.

## Sources and compatibility

- [Native reminder fields](https://raw.githubusercontent.com/go-vikunja/vikunja/v2.7.0/pkg/models/task_reminder.go)
- [Native persistence and renewal](https://raw.githubusercontent.com/go-vikunja/vikunja/v2.7.0/pkg/models/tasks.go)
- [Native API v2 task updates](https://raw.githubusercontent.com/go-vikunja/vikunja/v2.7.0/pkg/routes/api/v2/tasks.go)

No database, migration or new dependency. Earlier clients omitting reminders
preserve them. Rolling back the UI leaves reminders available in Vikunja.
Existing JSON Patch tests are checked before PUT; transaction-level concurrency
is not verified and is not newly promised by this feature.

## Acceptance and review

Verify create/edit/remove-all against real Vikunja; preserve imported relative
rules and timestamp precision during unrelated edits; reject malformed/duplicate
and DST times; retain retry/conflict behavior and native recurrence. Verify
mobile and desktop direct controls, previews and no task-date changes.

Review: correctness, security, architecture, performance and simplicity. Run
focused tests, a mutation check, final quality gates and browser checks.

## Verification — 2026-11-05

- Independent review identified same-value edits losing imported seconds and
  relative-offset dates exceeding the supported year range. Both were fixed.
- Simplification separated relative-rule resolution from absolute date/time
  validation; no notification scheduler or extra persistence was introduced.
- Mutation check inverted duplicate detection; the focused tests failed as
  expected. The original code was restored before final checks.
- Final `task validate`, `task test` (364 frontend tests plus Go race tests),
  and `task gen:check` passed.
- Real Vikunja 2.7: 15 desktop/mobile WebKit scenarios passed, covering reminders,
  editing and planning clocks. Reminder cases verify create, edit, remove-all,
  imported seconds/relative rules, native renewal and reminder-free history.
- Native Safari fixture preview refreshed at `http://127.0.0.1:4181/tasks/new`.
  WebKit layout checks at 320/768/1024/1440px found no horizontal overflow or
  page errors; mobile and desktop screenshots were visually reviewed.
  Delivery through email/push was not tested; only persistence and recurrence.
- No commits or production deployment.

Relative offsets use the GraphQL signed 32-bit seconds range. Relative rules use
negative offsets for before the selected native date. Preserved rules with no date anchor remain
inactive, matching Vikunja; setting the anchor later reactivates them.

## Relative-first UI — 2026-11-07

Two presets are directly visible: 2 hours before and 1 day before. Specific
calendar date/time remains available. Existing arbitrary offsets are displayed
in exact readable units and preserved unless the user selects a preset.
Native same-second collision protection also applies to inactive rules: only
one inactive reminder can be saved. Restore an anchor, choose another date or
remove an extra inactive rule; the UI explains this restriction.

Verification for the relative-first UI:
- Independent review found the inactive-rule collision restriction; the UI and
  this contract now disclose it. Follow-up review found no blockers.
- Eight real Vikunja desktop/WebKit scenarios passed: relative create/edit,
  deadline movement, conversion to absolute, preservation, removal and renewal.
- WebKit preview checked at 320/768/1024/1440px without horizontal overflow or
  runtime errors; phone screenshot inspected.
- Mutation check inverted before/after formatting; the focused test failed.
  Source was restored. Notification delivery itself remains untested.
- Final `task validate`, `task test` (372 frontend tests and Go race suites),
  and `task gen:check` passed. Safari preview assets updated at port 4181.
