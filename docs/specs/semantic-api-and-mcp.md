# Semantic API and MCP: initiative specification and capability map

2026-11-09. Intent accepted in [ADR-010](../decisions/0010-semantic-api-and-mcp.md).
Capability boundaries and module plan approved on 2026-11-09. Implementation and verification evidence are recorded in the linked task checklist.

## Outcome

An assistant understands the whole Better UI system without custom user prompts.
It explains situations and proposes actions; it changes data when instructed.
Useful behavior must remain achievable with smaller models and compact context.

## Approved capability map

| Stable module id | Responsibility | Depends on |
| --- | --- | --- |
| semantic-contract | Inventory concepts; describe GraphQL semantics, native mappings, examples and shared behavior checks | Existing services and ADRs |
| resource-efficiency | Project-wide measurement guidance and representative allocation/request/RAM/CPU baselines | Existing performance policy |
| mcp-interface | Discoverable concepts and typed actions through Go SDK; caller authorization, service reuse and deterministic contract checks | semantic-contract, resource-efficiency |

Order: semantic-contract and resource-efficiency, then mcp-interface. These are
documentation/verification boundaries, not new services or repository directories.
The approved Go MCP SDK dependency is pinned in go.mod.

## Module specifications

- [semantic-contract](semantic-contract.md): introspection documentation, concept
  traceability and behavior examples.
- [resource-efficiency](resource-efficiency.md): workload measurements, acceptance
  evidence and project-wide resource policy.
- [mcp-interface](mcp-interface.md): semantic tool/resource surface, permissions,
  compatibility, evaluation and remote HTTP authorization.

The user selected a remote Better UI MCP URL over Streamable HTTP. Local stdio
is out of scope. Manual URL plus Vikunja Bearer token is approved; native MCP
OAuth is currently unsupported. Model-runtime evaluation was declined by the user;
source-backed design and deterministic checks replace that proposed requirement.

## Current evidence and concept coverage

Inventory grounded in `internal/graphql/schema/*.graphqls`, existing ADRs/specs,
`internal/vikunja/client.go` and the upstream audit. This is initial coverage;
module specification must trace each concept to service code and concrete tests.

| Concept family | Existing source | Required machine understanding |
| --- | --- | --- |
| One-time work, recurring work, timed Jobs, invalid metadata | schema.graphqls; ADR-001/006/009 | Classification is not inferred from window length; invalid metadata is explicit |
| Availability, planned finish, deadline, duration | ADR-009; task-scheduling-examples.md | Distinct meanings and native start_date/end_date/due_date mapping; do not invent effort fields |
| Today, Active, custom period, Week/Month, unscheduled, long-term | task-planning-ui-proposal.md; weekly-ledger.md | Why a task belongs, boundaries/timezone, obligations versus optional available work |
| Recurring rhythm and projections | recurring-rhythm.md; recurring-jobs.md | Series versus occurrence; projected occurrences are not independently persisted tasks |
| Completion, skip, history, Undo, repair | ADR-001/002/003/006 | Side effects, retry/conflict rules, available recovery and partial success |
| Reminder rules | task-reminders.md | Native relative anchors/offsets and absolute instants; no scheduling-membership effect |
| Projects, labels, priority, Revisit | schema.graphqls; ADR-009 | User labels preserved; ordinary Revisit label versus reserved markers; sorting before pagination |
| Edit, create, reuse and replanning | task-form-main-rebuild.md; task-value-reuse.md | Explicit changes, preserved fields, versions and unsupported combinations |
| Parent/child, related tasks, references | relations.graphqls; task-discussion-api.md | Hierarchy constraints and partial linking failure; not visual time containment |
| Discussion, attachments and rich text | discussion.graphqls; media.graphqls; task-discussion*.md | Data versus instructions; format, pagination and authenticated media boundary |
| Activity and public aggregates | activity.graphqls; ADR-008 | Completion facts versus plans; privacy, completeness and freshness |
| Identity, timezone, permissions, diagnostics | schema.graphqls; ADR-004/005 | Caller scope, no privileged fallback, local dates/DST, unavailable versus empty |

Every family needs an explicit MCP representation: action, result semantics,
concept resource, or documented unsupported operation. Understanding a concept
does not require a separate tool or automatic exposure of every UI operation.

## Direction to validate in module specifications

- Put essential semantics in GraphQL introspection descriptions, not only Markdown.
  Include defaults, omission/null/empty behavior, units, timezones, mutation side
  effects, concurrency and partial errors where relevant. Link longer examples.
- Provide a short discoverable system overview and focused concept explanations.
  Critical constraints also belong in tool descriptions/results: some clients
  do not automatically read MCP resources or server instructions.
- Prefer typed domain actions over a generic API executor. Keep read paths free
  of writes. Preserve distinct operation results rather than flattening confirmed,
  uncertain and repair-required outcomes into success/failure.
- Return bounded structured results with scope, timezone and completeness.
  Do not return all descriptions/comments/media for a simple list or silently
  describe one page as the complete system.
- Explain chronological conflicts without equating an available planning window
  with a booked session. Suggestions are not persisted commitments.
- Sharing Go services is the default direction. MCP need not loop through the
  browser's GraphQL cookie/CSRF boundary. No service refactor is decided yet.
- Replanning must preserve reminder and recurrence rules, expose affected fields,
  and report per-task outcomes on partial failure. Do not promise atomic batches.

## Authorization research and accepted compatibility

Official pages reviewed on 2026-11-09; no user instance or credentials accessed.

- [Vikunja MCP](https://vikunja.io/help/mcp/) documents API tokens with read-only,
  typed read/write and full-access presets, expiry and per-action permissions.
  These are permission configurations, not evidence of three distinct token formats.
- [Vikunja API authentication](https://vikunja.io/docs/api-documentation/) recommends
  bearer API tokens; it also mentions self-hosted JWT login. This initiative does
  not introduce username/password login or JWT renewal.
- [Bot users](https://vikunja.io/docs/bot-users/) are another principal to include
  in compatibility testing; an account category is not itself a token format.
- [MCP security guidance](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices)
  forbids unvalidated token passthrough and requires tokens issued for the MCP
  server. A configured upstream URL alone does not resolve audience validation.
- [Go SDK protocol documentation](https://github.com/modelcontextprotocol/go-sdk/blob/main/docs/protocol.md)
  describes Streamable HTTP, stateless operation and auth primitives. Pin an
  actual supported release/protocol combination when implementing; main is moving.

Do not equate native Vikunja MCP access with permission for every REST endpoint
used by Better UI. Verify the supported Vikunja source/version and real fixtures
for read-only, custom scope, read/write, expired/revoked, bot and forbidden-project
cases, including `/user`, projects and marker lookup dependencies.

Resolved in ADR-010: the user approved manual Bearer API tokens, matching native
Vikunja setup, without claiming MCP OAuth compliance. Native MCP documentation
and v2.7.0/main handlers do not support OAuth. No issuer, token store or exchange
service is added. Recheck this limitation when upgrading Vikunja.

## Validation expectations for downstream specifications

1. Concept coverage table maps every current concept to descriptions, MCP surface
   and tests; future concepts extend the same table.
2. Shared fixtures produce equivalent business outcomes through UI/GraphQL and
   MCP. Exercise dates/DST, omissions, projections, recurrence and failures.
3. Scenario evaluations span planning, recurring work, reminders, relations,
   history and delegated replanning. Include the original Today failure as one
   regression. Record model/version, prompt, tools exposed, calls, output size,
   semantic errors and resulting state. Select representative small models before
   claiming small-model success; none have been tested yet.
4. Reads issue no writes. Unauthorized, expired and insufficient tokens cannot
   use the application credential. Concurrent callers cannot share private data,
   in-flight results or repair/Undo capabilities across authorization scopes.
5. Measure representative small and large workloads plus concurrent callers;
   record allocs/op, B/op, upstream calls, CPU profiles and idle/peak RSS. Existing
   performance numbers are historical, not this initiative's measured baseline.
6. Enforce bounded pagination/concurrency/output, cancellation and upstream body
   limits; preserve freshness and authorized public aggregate caching.

## Work boundaries and verification state

This change records requirements and updates development instructions only. No
API/schema behavior, dependencies, data, container configuration or auth changed.
Documentation links and `git diff --check` are checked locally. No runtime,
benchmark, SDK integration, live token or model compatibility result is claimed.

Detailed module specs must identify files, exact container commands, acceptance
cases and review checkpoints before implementation. Existing full checks are
`task validate`, `task test`, and `task gen:check`, executed in the matching Dev
Container after code changes; see AGENTS.md and Taskfile.yml.
