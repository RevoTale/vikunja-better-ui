# Semantic API and remote MCP checklist

2026-11-09. Implemented and verified plan. A checked row requires its
entire acceptance condition, not merely files being present.
Owner: [plan](semantic-api-mcp-plan.md). Each row is a focused slice with acceptance,
verification, dependencies and likely files. New filenames are proposed. Keep
individual substeps within roughly five handwritten files; generated outputs are
regenerated together. Split listed action families into per-action substeps before
editing instead of creating oversized modules.

## Foundation

| Task | Acceptance and verification | Depends on | Likely files / scope |
| --- | --- | --- | --- |
| [x] T01 Resolve HTTP token contract | Inspect pinned upstream token middleware/presets, REST rights and SDK auth. Verify isolated read-only/custom/write/bot/expired/revoked tokens. Record issuer/audience and client compatibility separately; obtain a decision if constraints conflict. | — | mcp-interface.md, ADR-010, isolated integration fixture/test; M |
| [x] T02 Finish concept traceability | Every concept maps to actual service rule, public description, example and test; identify UI-only calculations needing shared extraction. Verify all source paths and discrepancies. | — | semantic-contract.md, semantic-api-and-mcp.md; S |
| [x] T03 Refresh representative baseline | Record versions/fixtures, allocations, calls, CPU and RSS or explicit missing evidence. Run existing benchmarks and isolated load checks from resource-efficiency spec. | — | performance.md, existing benchmark tests, upstream-api-audit.md; M |

- [x] Checkpoint F: Review evidence; independent documentation work can continue
  if HTTP auth is unresolved, but T07 cannot expose an endpoint.

## GraphQL contract

| Task | Acceptance and verification | Depends on | Likely files / scope |
| --- | --- | --- | --- |
| [x] T04 Document scheduling and lifecycle | Correct kind/date/scope/recurrence/reminder/default/partial-result descriptions; examples agree with Create and Edit. Focused service/resolver tests and introspection review. | T02 | schema.graphqls, scheduling examples, focused resolver test; M |
| [x] T05 Document remaining concepts | Discussion, relations, media, activity and avatar contracts explain scope and side effects. Split by domain into 2–3-file substeps; verify against owning service/tests. | T02 | domain schema extensions and owning specs/tests; M per substep |
| [x] T06 Prevent undocumented contract additions | Lightweight coverage gate catches newly undocumented domain operations/types without snapshotting all prose; generated files current. Run task gen, focused gate test and full checks. | T04, T05 | tests/quality contract test, generated outputs, semantic-contract.md; M |

- [x] Checkpoint G: Review/fix/simplify/re-review descriptions; run final
  `task validate`, `task test`, `task gen:check`. No API behavior changes hidden here.

## Remote read-only MCP

| Task | Acceptance and verification | Depends on | Likely files / scope |
| --- | --- | --- | --- |
| [x] T07 Add SDK and HTTP lifecycle | Pin verified SDK release; disabled/optional endpoint wiring has correct version, origin, size/time/cancellation handling under resolved auth. Initial read-only stage precedes delegated writes. Integration lifecycle tests pass. | T01 decision, T03, T06 | go.mod/go.sum, internal/mcp handler/test; subsequent wiring/config substep <=5 files |
| [x] T08 Isolate caller context | No app-token fallback, cross-token state or credential logs; same-principal transport reuse is measured. Two-principal concurrent/revocation tests pass. | T07 | internal/mcp principal/client/handler tests, existing client option only if needed; M |
| [x] T09 Publish system concepts | Overview/resources/explain_concept expose all concepts; critical constraints also available without resource support; no upstream task reads for static explanations. SDK discovery test and definition-size measurement. | T02, T08 | internal/mcp concept definitions/handler/test, embedded docs; M |
| [x] T10 List and inspect tasks | Typed scopes/filters/pagination and explicit detail sections match services; partial/forbidden is not empty success. Service parity and isolated HTTP tests pass. | T08, T09 | internal/mcp list/detail handlers/tests; M |

- [x] Checkpoint R: Verify an actual read-only HTTP client connection, denied
  writes, identity isolation, bounded output and full quality gates.

## System views

| Task | Acceptance and verification | Depends on | Likely files / scope |
| --- | --- | --- | --- |
| [x] T11 Agenda composition | Obligations, sessions, projections and optional active work remain distinct; actual overlaps exclude adjacent intervals; each section reports completeness. Fixed-clock/DST and bounded-overlap tests. | T10 | shared agenda service/test if needed, MCP handler/test; M |
| [x] T12 Recurring overview | Show series frequency over requested period without persisting projections; match current UI semantics. Shared fixtures for interval/mode/timezone and call counts. | T10 | shared rhythm projection/test if needed, MCP overview/test; M |
| [x] T13 Context and activity | Projects/labels/context and caller-scoped aggregates preserve rights; metadata/detail expansions are explicit. Split context/activity/media-metadata into <=4-file substeps; privacy tests. | T10 | internal/mcp context/activity/detail handlers/tests; M per substep |

- [x] Checkpoint V: Review full concept coverage, incomplete results and resource
  costs. Run focused tests and full gates before enabling writes.

## Delegated mutations

| Task | Acceptance and verification | Depends on | Likely files / scope |
| --- | --- | --- | --- |
| [x] T14 Create typed task kinds | Implement one-time, recurring and Job creation as separate small substeps. Native field/marker/reminder mapping and partial outcomes match services; insufficient scope never escalates. | T10, T01 write-right evidence | MCP per-kind handler/test, shared orchestration only as needed; M per kind |
| [x] T15 Edit explicit fields | Omission preserves; omitted/null preserves and explicit clear or empty lists clear; stale version fails before mutation. Replanning leaves unrelated fields intact. Native readback and conflict tests. | T14 | explicit changes types/merge/test, edit handler/test; M |
| [x] T16 Complete and skip | Preserve renewal/history and displayed-occurrence checks; lost responses do not cause blind repeats. Separate completion/skip substeps with real Vikunja tests. | T14 | MCP lifecycle handlers/tests, service integration fixtures; M per action |
| [x] T17 Bind recovery to MCP caller | Grants reject UI/cross-user/cross-token/expired replay; fresh rights enforced; UI grants unchanged. Resolve principal-binding design before modifying capability code. | T08, T16 | capability binding/test, MCP recovery/test; M |
| [x] T18 Relations and subtasks | Reuse cycle/parent constraints and partial-link outcomes, preserve project rights. Per-action service parity tests. | T14 | MCP relation/subtask handlers/tests; M per action |
| [x] T19 Discussion and labels | Explicit comment actions and ordinary-label creation preserve format/permissions; user labels untouched; task text never treated as instructions. Per-action tests. | T14 | MCP comment/label handlers/tests; M per action |
| [x] T20 Delete explicitly | Named target, existing deletion guards and truthful concurrency limits; read requests cannot delete. Verify forbidden/stale/missing cases and documented client confirmation responsibility. | T10, T01 write-right evidence | MCP delete handler/test, concept description; M |

- [x] Checkpoint W1 after T14–T16: Inspect persisted fields and failure outcomes;
  review/fix/simplify and full gates.
- [x] Checkpoint W2 after T17–T20: Review permission/capability boundaries and all
  write annotations; full gates. No blanket retry or bulk-atomicity promises.

## Acceptance and handoff

| Task | Acceptance and verification | Depends on | Likely files / scope |
| --- | --- | --- | --- |
| [x] T21 Verify agent-facing contract and clients | User declined model-runtime testing. Apply researched tool-design practices, deterministic semantic/protocol scenarios and measured definitions/results; document model accuracy as unverified. Client/version matrix included. | T11–T20 | contract fixtures/results, mcp-interface.md; split checks and report substeps |
| [x] T22 Measure and simplify | Compare T03 baselines plus MCP discovery/read/write/concurrency workloads; remove measured waste, retain correctness and isolation. CPU/RSS/call/allocation evidence explicit. | T21 findings | performance.md, focused benchmark/tests and owning code; <=5-file substeps |
| [x] T23 Final docs and checks | Setup URL/auth, scopes, supported/unsupported operations and rollback documented; current concept matrix complete. Focused tests then task validate/test/gen:check/e2e after final edits. | T21, T22 | README.md, .env.example if new configuration, ADR/specs; split docs and verification |

- [x] Final checkpoint: Evidence covers final revision; remaining limitations are
  explicit. No commit/push/release/deployment without a separate instruction.

## Increment evidence — 2026-11-09

- SDK pinned to v1.8.0. GraphQL descriptions and an introspection coverage test
  added; generated outputs refreshed through `task gen`.
- Native 2.7.0 HTTP fixture passed discovery, Today read, denied read-only creation,
  revoked-token rejection and JWT rejection (`mcp-auth.spec.ts`, desktop-1440).
  The pr-chromium filter excluded this new test; that first attempt ran no tests.
- Manual Bearer decision and OAuth limitation are recorded in ADR-010. Custom,
  expired, bot-owned and cross-principal recovery cases remain to verify.
- The user replaced model-runtime evaluation with researched design and automated
  contract checks. No model accuracy claim or user-run evaluation is required.
- Read/context coverage, lifecycle mutations, relations/discussion, performance
  comparison and final full quality gates remain tracked above. Partial progress
  does not mark those tasks complete.
- Current increment: focused race tests and full `task validate`, `task test`,
  `task gen:check` passed. Frontend: 65 files / 374 tests. Full validation initially
  caught two oversized functions; token-route wiring and feature-flag loading
  were separated by responsibility and rechecked without raising limits.
  The successful build emitted a non-fatal Go module stat-cache permission warning.
  These results do not complete the remaining capability/acceptance work.

## Completion evidence — 2026-11-09

This supersedes the first-increment status above; historical results are retained
for traceability. T01–T23 and the final checkpoint are complete. Measurement and client limits below remain explicit rather than
being represented as tested production properties.

- Foundation/contracts: caller token permissions verified against native 2.7;
  schema descriptions regenerated and checked by a public-contract coverage gate.
  No GraphQL signature changes. Concept coverage links services, examples and tests.
- Reads: 23 typed tools and 13 concepts, real SDK HTTP connection, enum/schema and
  effect annotations, Today/Active separation, native month-window versus Job
  behavior, partial agenda sections, activity and recurring frequency fixtures.
- Writes: native creation/readback, exact omitted-date preservation, relative
  reminders, stale edits, completion/skip/history, caller-bound Undo, relations,
  subtasks, comments and deletion. Native marker failure returns repair without
  duplicating the task; another token cannot use the returned capability.
- Authorization: read-only, custom route scope, write-capable, bot-owned,
  inaccessible-project, expired/revoked and JWT cases. Unit/race tests cover caller
  transport isolation and UI/cross-principal/expired recovery boundaries.
- Review → fix → simplify → re-review: independent Astra reviewer found four
  defects (unsupported old recurrence prevented replacement; DST-fold round-trip;
  page overflow; completed-job bounds/order). All fixed with regression tests.
  Final independent static review found no new confirmed defects. No additional
  read was added for a speculative relation/version issue: native relation creation
  does not directly update the task and versions exclude relations.
- Mutation experiment: inverted the page upper-bound condition; the overflow
  regression test failed as expected. Restored the original file before final
  checks. No intentionally broken code remains.
- Simplification: compact mutation references removed repeated full-detail schemas.
  Discovery is 38,085 bytes instead of 56,256; allocations fell about 35%. CPU/RSS,
  fixture, commands and interpretation are in docs/performance.md.
- Limits: no model runtime was used, as requested. Individual desktop-client
  interoperability and production sustained-concurrency/read-write latency are
  not measured. The SDK client and deterministic server behavior are verified;
  no universal small-model accuracy claim is made.

Final revision checks in the matching Dev Container:

- Focused Go race tests: MCP, service and Vikunja packages passed.
- `task validate`: passed, including strict lint, formatting, modernization,
  quality-gate tests, typecheck and production builds.
- `task test`: passed; Go race detection, two shuffled runs; 65 frontend test files,
  374 tests passed.
- `task gen:check`: passed; gqlgen and frontend generated artifacts reproducible.
- `task e2e`: 232 passed in 5.1 minutes across phone-320, phone-webkit,
  desktop-1440 and timezone-webkit, using isolated native Vikunja 2.7.0.
- `git diff --check`: passed. Review/fix/simplify/re-review complete.

Non-failing diagnostics: the Go build emitted a module stat-cache permission
warning; the timezone WebKit scenario emitted the existing stylesheet CSP warning.
Neither check failed. No production deployment, commit, push or release performed.
