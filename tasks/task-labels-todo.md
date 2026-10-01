# Task labels checklist

Implemented. Reset autosave references below describe historical verification;
that feature was subsequently removed. See [current plan status](README.md).

- [x] Protected labels: reject marker titles/IDs; list/create ordinary labels;
  verify authorization, CSRF, duplicate names and retry behavior.
- [x] Create/edit assignment: validate before writing, preserve markers, report
  partial outcomes without duplicate tasks; verify focused Go tests.
- [x] Form picker: select/create/remove ordinary labels, show loading/errors,
  reset selections with Reset autosave; verify typecheck, unit and browser tests.
- [x] Filter: Today/No date only, stable label IDs, URL/back/pagination handling,
  server-side filtering and internal-label rejection; verify unit tests.
- [x] Browser verification: real fixture, create/edit/filter, responsive picker,
  no hidden markers and no value collision.
- [x] Update README and product behavior; review, simplify and re-review.
- [x] Final checks: gen:check, validate, test, e2e. Report exact outcomes.

## Verification

- Running Dev Container: focused Go tests and 13 focused frontend tests passed.
- `task gen:check` and `task validate` passed.
- `task test` passed: Go race tests and 202 frontend tests.
- Five focused browser tests passed; final `task e2e`: 241 passed in 4.9 minutes.
- Chromium desktop/mobile and WebKit mobile cover label creation, selection,
  reset, editing and Today/No date filters against the isolated Vikunja fixture.
- Failure tests cover label retry, newer draft text during delayed creation,
  blocked concurrent submission and navigation to a partially saved task.
- Review/simplification consolidated label validation and duplicate-title display,
  separated edit confirmation, and kept label validation concurrent with user and
  project reads. No new dependencies or generated UI edits.
- Updated the mobile spacing assertion to measure from the new last filter;
  retained its original 20 px limit. Existing WebKit stylesheet CSP warning
  remains; no test failures. No commit, push or deployment.
