# Specification: semantic-contract

Status: implemented, 2026-11-09. Boundary approved in the
[initiative map](semantic-api-and-mcp.md); intent: [ADR-010](../decisions/0010-semantic-api-and-mcp.md).

## Objective and scope

Make the existing business contract understandable through GraphQL introspection
and reusable by MCP. Cover every concept in the initiative inventory, not merely
dates or Today. This module changes descriptions and verification, not existing
GraphQL signatures, input defaults, business rules or native storage.

## Contract requirements

1. Document every public domain enum/value, scalar, query/mutation, input and
   result type. Field descriptions must explain meaningful semantics rather than
   repeat names. Simple identifiers may refer to their containing type's contract.
2. For each operation describe purpose, scope, permissions/dependent reads,
   pagination, defaults, side effects, concurrency and partial outcomes as applicable.
   Explicitly distinguish a projected occurrence from a persisted task.
3. For input fields specify omission, explicit null and empty values independently
   according to actual gqlgen/resolver behavior. Never infer that nullable means
   'clear'. For collections explain replacement versus append semantics.
4. Explain local dates/times versus instants, the Vikunja user's timezone, DST
   rejection and date-only end boundaries. Start/end/due mappings stay unchanged.
5. Explain Job recurrence as orthogonal to Job kind, invalid marker combinations,
   recurring renewal/history, skip, repair and the limited Undo window. Do not
   imply all mutations are safely retryable or all completions are undoable.
6. Explain incomplete pages, unavailable counts, conflict/version checks and
   confirmed partial writes without exposing raw upstream errors or secrets.
7. Document which rules are UI defaults rather than API defaults. For example,
   the form's automatic start and reminder presets must not silently become
   GraphQL schema defaults.
8. Every concept has an owner, a native mapping when persisted, an observable
   example, a service test and an API verification. Maintain this mapping here
   and link owning ADRs/specs rather than copying their complete history.

## Traceability baseline

Paths below are relative to `internal/`. Existing tests are starting evidence,
not proof that future descriptions or MCP output have been verified.

| Concept | Implementation anchor | Existing verification anchor |
| --- | --- | --- |
| Kind and marker interpretation | service/task_kind.go | service/task_kind_test.go |
| Planning and Today/Active/period | service/planning_window.go, planning_period.go | service/planning_window_test.go, planning_period_test.go; graphql/resolver/planning_test.go |
| Day/week and projections | service/day_view.go, week_view.go | service/day_view_test.go, week_view_test.go, planning_week_test.go |
| Recurrence, completion and history | service/recurring_completion.go, recurring_snapshot.go | service/recurring_completion_test.go, recurring_occurrence_test.go |
| Undo and repair | service/capability.go, repair_workflow.go, recurring_repair.go | service/capability_test.go, recurring_repair_test.go |
| Reminder preservation and anchors | service/reminders.go | service/reminders_test.go |
| Versions, clearing, labels, edit | service/task_edit.go, task_labels.go | service/task_edit_test.go, task_edit_labels_test.go |
| Reuse values | service/task_reuse.go | service/task_reuse_test.go |
| Relations and reference links | service/task_relations.go, reference_linking.go | service/task_relations_test.go, reference_linking_test.go |
| Discussion and attachments | service/task_discussion.go; graphql/schema/discussion.graphqls, media.graphqls | service/task_media_test.go; existing discussion suites |
| Activity and completeness | service/current_activity.go, public_activity.go, all_time_activity.go | service/current_activity_test.go, public_activity_timeliness_test.go, all_time_activity_test.go |
| Pagination and ordering | service/list_workflow.go | service/list_workflow_test.go; specs/upstream-api-audit.md |

Session, profile/avatar and media transport descriptions must also be covered;
they do not become alternate MCP authentication or public download endpoints.

## Examples and presentation

Descriptions are concise English, matching the schema; user-intention examples
retain the existing documentation language. Example of the intended style, to be
checked against the implementation before use:

```graphql
"""
Beginning of availability, stored as Vikunja start_date. For a timed Job this
is the scheduled session start. It is not a completion deadline.
"""
startAt: DateTime
```

The scheduling examples remain in `task-scheduling-examples.md`. Add cross-links
for recurrence, labels, discussion, history and partial failure. A change is not
complete if its explanation is correct only for Create but false for Edit.

## Acceptance

- Introspection exposes reviewed descriptions for the entire handwritten schema,
  including extensions in discussion, relations, media, avatar and activity.
- 'Available all month' is not described as a month-long reserved session or as
  an obligation to complete today. Reminder changes do not move view membership.
- Examples assert both returned behavior and persisted native fields, not merely
  that documentation strings exist.
- A small coverage check catches undocumented new domain operations/types; a
  human review checks semantic accuracy. Avoid brittle snapshots of all prose.
- Documentation does not conceal discrepancies. Fix misleading comments when
  code and accepted decisions agree; record unresolved behavioral discrepancies
  separately rather than changing behavior under this module.

Known audit targets: UpdateTaskInput.planningWindow currently says date-only
despite clock inputs; create reminder inputs say 'preserves' despite creating a
new task. Check these against resolver/service code before replacing descriptions.

## Files, commands and verification

Edit handwritten `internal/graphql/schema/*.graphqls`, owning docs and focused
contract tests. Regenerate gqlgen/TypeScript through Taskfile; never hand-edit
generated files. Test coverage belongs in existing resolver/service/quality suites.

From the matching Dev Container workspace (identify/start it under AGENTS.md):

```sh
task gen
go test -race -count=1 ./internal/graphql/... ./internal/service/...
task validate
task test
task gen:check
```

These are implementation verification commands, not claims of runs for this spec.
Review every concept row against code, decisions and tests after the final edit.

## Boundaries and rollback

Always preserve schema compatibility, native mappings and current workflows.
Ask before incompatible API changes or changing accepted semantics. Never add
an unsupported effort field, modify user labels or expose authentication secrets.
No DB, migration or runtime service is added. Revert descriptions/generated output
together if needed; persisted tasks are unaffected.

## Implemented verification

Schema descriptions and generated artifacts are updated together. The coverage
gate is `internal/graphql/resolver/semantic_contract_test.go`; it checks public
root operations and domain types rather than snapshotting prose. The earlier
planning-window and create-reminder wording discrepancies are corrected.

MCP verification supplements the service anchors above: `internal/mcp` covers
Today/Active, partial agenda sections, schema/effects, cancellation, bounded pages,
DST-preserving edits and capability isolation. `frontend/e2e/mcp-*.spec.ts` uses
isolated native Vikunja 2.7 for token permissions, lifecycle, reminders, discussion,
relations, recovery and session-versus-availability behavior. Rhythm normalization
lives in `service/recurring_frequency.go` with fixtures matching current UI formulas.
The UI still renders its existing formula; cross-language code is not shared.
