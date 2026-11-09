# ADR-010: Expose the Better UI system through semantic APIs and MCP

## Status

Product intent and capability boundaries accepted on 2026-11-09 in the
[initiative specification](../specs/semantic-api-and-mcp.md). The module plan and
manual Bearer transport are implemented; verification is tracked in the checklist. Existing
UI authentication remains unchanged; MCP has its own caller-token boundary.

### Clarification — 2026-11-09

The user approved the separation into semantic-contract, resource-efficiency and
mcp-interface. Detailed specifications are linked from the initiative index.
The user subsequently clarified that only a remote HTTP endpoint is intended:
Codex or another AI client -> Better UI MCP URL -> Vikunja. Local stdio was an
assistant-proposed alternative, not a user requirement, and is out of scope.
Use Streamable HTTP; resolve authorization within this deployment model without
requiring a local adapter. Token issuance remains exclusively in Vikunja.

The user subsequently approved manual URL + Vikunja Bearer token setup, with
upstream rights enforcement and no OAuth compliance claim. They requested native
MCP OAuth support if Vikunja provides it. Pinned v2.7.0 and current main MCP handlers
reject JWTs and require API tokens with mcp:access; official MCP help states OAuth
is not supported. Do not substitute Vikunja's unrelated OAuth login flow.
Recheck native MCP OAuth when updating supported upstream versions.

### Clarification — model verification, 2026-11-09

The user declined model-runtime testing and asked the implementer to research
practices and choose the organization independently. Replace the proposed
two-small-model-plus-reference acceptance requirement with source-backed design,
protocol/semantic regression tests and measured payload/resource costs. Do not
ask the user to run model checks. Model-specific understanding remains unverified;
deterministic tests are not evidence of model tool-selection accuracy. The
current design and sources belong to the MCP specification.

## Context

The user asked an assistant for today's tasks and received five long-running
tasks without deadlines instead of a useful picture of the day. Raw task access
does not convey Better UI's concepts. Existing decisions already organize the
data into meaningful workflows; assistants should benefit from those rules.

## Accepted requirements — 2026-11-09

1. Explain the entire Better UI system, every concept and their relationships.
   Today is an illustrative scenario, not the scope boundary. Do not require the
   user to repeat the system's mindset in every conversation.
2. Support smaller models with clear actions, compact schemas/results, examples
   and server-side classification. Documentation alone cannot guarantee model
   understanding; evaluate observable tool selection and resulting task state.
3. Reading requests explain and propose without writes. Execute changes,
   including replanning, when the user delegates them. A model-generated boolean
   is not proof of human consent; client interaction and server permissions have
   different responsibilities.
4. GraphQL documentation explains business semantics and edge cases. Each business
   change updates affected GraphQL and MCP contracts, examples and checks. This
   does not require a new MCP tool for every new concept.
5. Use `github.com/modelcontextprotocol/go-sdk` for MCP. Reuse application service
   rules rather than maintaining independent GraphQL and MCP business logic.
6. Users create tokens in their official Vikunja instance and supply them during
   MCP connection setup. Better UI does not create tokens. Preserve supported
   token permissions; establish actual compatibility before promising token types.
7. Resource efficiency is a project-wide continuing requirement: allocations,
   external request count, RAM and CPU. The user's clarification concerned
   efficient implementation generally, not a new abuse-management feature.
   Numerical budgets remain open until measured; correctness is not negotiable.

## Boundaries and consequences

- No new database, task store or migration. Existing native fields and marker
  semantics remain authoritative; this initiative introduces no new task fields.
- No autonomous task changes, automatic background manager, token issuer,
  arbitrary upstream URL or generic REST/GraphQL execution tool.
- Existing UI auth, GraphQL behavior and public aggregate privacy remain intact.
- The MCP adapter must never fall back to the app's privileged environment
  token when a caller's token is missing, denied or insufficient.
- Undo, repair and partial-failure capabilities must retain their existing scope
  and must be bound to the correct caller when exposed through a new auth boundary.
- Documentation-only changes can be reverted without data effects. An eventual
  MCP rollback must disable its entrypoint without deleting native Vikunja data.

## Alternatives and open decisions

Directly exposing Vikunja tools is simpler, but leaves the model to reconstruct
Better UI semantics. A large system prompt can explain rules but does not enforce
classification or stop drift. Shared services plus concise semantic contracts are
the preferred direction; concrete tool granularity needs evaluation.

Bearer-token setup and MCP OAuth compliance are distinct. Official MCP guidance
forbids accepting tokens not issued for the MCP server and passing them downstream.
The existing Jobs token adapter (ADR-004) is useful local precedent, not proof of
MCP authorization compliance. The accepted custom Bearer profile above resolves
the deployment choice without claiming OAuth compliance.

See the linked specification for sources, coverage and remaining verification.

## Implementation decisions — 2026-11-09

1. The user declined model-runtime evaluations and asked us to select practices
   independently. Use researched semantic tools, explicit schemas, deterministic
   protocol/native fixtures and measured costs. Model accuracy remains unverified;
   do not make the user run a model acceptance test.
2. Expose 23 explicit tools and 13 static concept resources through the approved
   remote Bearer profile. Core constraints also appear in tool instructions because
   clients may ignore resources. See the implemented surface in the MCP spec.
3. Keep the token owner's context authoritative. A new native bot can have no
   timezone: context reports schedulingReady=false; calendar calls require setup
   instead of borrowing the app owner's timezone.
4. Partial MCP edits preserve omitted native instants exactly. A title change
   during a DST fold must not fail or change stored seconds; explicit ambiguous
   date changes still fail. Full-form GraphQL defaults remain unchanged.
5. Prefer compact mutation references plus explicit detail reads. Discovery fell
   from 56,256 to 38,085 bytes for the same 23 actions. This reduces repeated
   schemas without hiding versions, partial outcomes or recovery instructions.
6. Fresh native authorization applies to every request. Recovery keys are domain
   separated from UI capabilities and bound to the caller token. No persistence,
   new native fields or task migration. Disable APP_MCP_ENABLED to roll back the
   endpoint; already requested native writes remain.
7. Keep calendar/list bounds explicit and work bounded: pagination rejects integer
   overflow; completed-job scopes carry local completion bounds; independent agenda
   failures stay visible. Request limits are 1 MiB, 30 seconds and 16 concurrent calls.
