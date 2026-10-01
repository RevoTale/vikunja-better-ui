# Plan status

Audit: 2026-10-01. This index distinguishes current work from historical
checklists. An unchecked box in an old plan is not by itself a missing feature.
Do not restore superseded behavior to satisfy an old checklist.

## Completed in the current working tree

- [Task relationships](task-relationships-todo.md): native related tasks,
  parent/child workflows, automatic relations from confirmed content saves,
  shared rich descriptions and Unicode emoji insertion. The Job marker rename
  is already implemented.
- [Skip occurrence safety](todo.md#task-10-bind-skip-to-the-displayed-occurrence):
  missing/stale/replayed requests and partial failures now have service,
  resolver and browser regression coverage.

No active implementation slices remain. On 2026-10-01, generation, strict
validation, Go race/shuffle tests, 277 frontend tests and 369 browser scenarios
passed locally in the existing Dev Container. Chromium used the approved
156.0.8075.0 executable override; WebKit used the bundled runtime. The known
Today stylesheet CSP warning remains in the passing timezone WebKit scenario.
This is local verification, not CI or production acceptance. Final results are
also recorded in the linked checklists; physical-device acceptance remains below.
New dependencies still require approval.
No commit, push, production data migration or deployment is implied.

## Implemented; retain as historical records

- [Quality gates](quality-gates-todo.md).
- [Discussion links and compact layout](discussion-links-todo.md).
- [Discussion/editor/media](task-discussion-todo.md).
- [Task labels](task-labels-todo.md).
- [Completed Jobs](completed-jobs-todo.md).
- [Base UI migration](shadcn-base-ui-todo.md).
- [Task editing](task-editing-plan.md), except the superseded autosave control.
- [Fixed due time](../docs/specs/keep-due-time.md): the original
  [checklist](keep-due-time-todo.md) predates the implemented recurring-Job
  support and is not an instruction to reject Jobs now.

Previously recorded CI verification is run
[36789208186](https://github.com/RevoTale/vikunja-better-ui/actions/runs/36789208186)
at `24c0dff795fcadcb4234930af35c4be5a093c4af`: generation, validation,
unit/race tests, image smoke test and 320 browser tests passed. This evidence
covers that commit, not subsequent implementation changes.

## Superseded or explicitly excluded

- Automatic task-creation autofill and Reset autosave: removed. Use explicit
  [task-value reuse](../docs/specs/task-value-reuse.md); never silently restore
  field values. Local draft recovery is a separate feature.
- Migration/relabeling of existing `job` labels: explicitly excluded. Only
  `vbu:job` classifies a Job; `job` is an ordinary label.
- Old rules rejecting fixed-due-time recurring Jobs: superseded by supported
  recurring Jobs. Preserve current recurrence semantics.
- Historical Chromium runtime failures: not current CI blockers; keep their
  diagnostic records without reopening completed feature work.
- Past commit/push authorization checklist items: workflow boundaries, not
  unfinished product features or standing authorization.

## Manual verification, not automated completion

- Physical iOS home-screen installation and device-specific behavior in
  [the PWA checklist](../docs/pwa.md).
- Physical mobile keyboard and production-instance acceptance of Discussion.

These remain unverified until actually tested. Emulator/browser CI does not
substitute for physical-device acceptance.
