# Recurring rhythm

Decision: [ADR-001](../decisions/0001-recurring-history-snapshots.md).

The recurring page explains the frequency of each habit across a week, month,
or year. It preserves the existing task cards and recurrence groups.

- A directly visible Week / Month / Year control changes the comparison unit.
- Each group's heading shows frequency per habit, not a combined group total.
- These are average rates, not calendar forecasts, completion counts, or quotas.
  Use 365.2425 days per year, one twelfth per average month, and seven per week.
  Same-unit ratios remain exact; rounded values and cross-calendar conversions
  carry an approximation sign. Values below one read “less than once”.
- Each card states whether its schedule is fixed or starts again after completion.
  For the latter, the frequency assumes completion without delay.
- Group counts describe only the current page and filters; never claim a total
  for the entire system from a paginated response. Preserve existing pagination.
- Use existing recurrenceRule interval/unit/mode from GraphQL, derived from native
  Vikunja repeat fields. No new persistence, API changes, dependencies, or migration.
- Keep cards, completion, filtering and Today behavior intact. Reverting the UI
  has no data impact.

Checks: daily → 7/week; fortnightly → less than once/week; monthly → 12/year;
calendar conversions approximate; completion-driven rules identified; mobile
controls and long titles fit without horizontal overflow.

## Verification — 2026-11-06

- Focused frequency tests: 3 passed. `task validate`, `task test` (367 frontend
  tests and Go race tests), and `task gen:check` passed.
- Real Vikunja overview E2E: desktop Chromium and phone WebKit passed, including
  period switching, group frequency and unchanged creation entry point.
- Host preview checked in WebKit at 320, 768, 1024 and 1440 px: no horizontal
  overflow or runtime errors. Mobile screenshot visually inspected.
- Review retained existing pagination and explicitly labels per-page counts.
  This view does not claim to forecast dates or measure habit adherence.
