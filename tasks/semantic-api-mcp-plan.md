# Implementation plan: semantic API and remote MCP

2026-11-09. Implemented plan; see the checklist for verification evidence.
Specifications: [initiative](../docs/specs/semantic-api-and-mcp.md),
[semantic contract](../docs/specs/semantic-contract.md),
[efficiency](../docs/specs/resource-efficiency.md),
[MCP](../docs/specs/mcp-interface.md).

Tasks are tracked in [semantic-api-mcp-todo.md](semantic-api-mcp-todo.md).
Use the existing named-plan convention; preserve historical plan.md/todo.md.

## Accepted direction and authorization boundary

Remote Streamable HTTP only: AI client -> Better UI URL -> shared Go services ->
configured Vikunja. Users create tokens in Vikunja and configure them outside
model arguments. Use the Go MCP SDK; no extra task database, local adapter or
token issuer. Keep UI authentication and all current business semantics intact.

The user approved native-style manual Bearer API tokens. ADR-010 records the
verified native limitation: no MCP OAuth support. Each request checks native MCP
access and uses only the caller token for subsequent REST actions.

## Dependency order and review points

1. **Foundation:** T01 authorization evidence, T02 concept coverage, T03 resource
   baseline. T02/T03 do not depend on resolving T01.
2. **Semantic contracts:** T04/T05 GraphQL descriptions and behavior verification;
   T06 drift check. Preserve generated-code reproducibility.
3. **First remote read:** T07 SDK/HTTP boundary, T08 principal isolation, T09
   concepts, T10 lists/details. Depends on authorization decision. This milestone
   delivers a real read-only MCP path before any write tools exist.
4. **System views:** T11 agenda, T12 recurring overview, T13 activity and detail
   sections. Each slice retains pagination, completeness and native semantics.
5. **Delegated actions:** T14 creation, T15 explicit editing/replanning, T16
   completion/skip, T17 recovery, T18 relations, T19 comments/labels, T20 deletion.
   Split per-action substeps before editing; never bundle all mutations at once.
6. **Acceptance:** T21 agent-facing contract/client checks, T22 resource comparison, T23
   documentation and final gates. Findings return to the owning slice.

After each 2–3 related slices, review -> fix -> simplify -> repeat review, then
run the relevant focused checks. Existing user scope authorizes routine fixes;
only unresolved behavioral or architectural choices require another question.
No sub-agent delegation is required by this plan.

## Architecture and implementation constraints

- Domain services own semantics. GraphQL and MCP adapters handle input/context/
  result translation. Extract shared orchestration only when a concrete slice
  needs it; do not rebuild the service architecture preemptively.
- Static concept definitions are loaded once. Typed operation descriptions carry
  essential constraints even when clients ignore resources.
- Domain output distinguishes obligations, availability, booked time, projected
  recurrence and historical facts; list pagination is never hidden.
- Caller context is separate from app-session credentials. No environment-token
  fallback. Recovery capabilities need MCP-specific principal binding without
  changing existing UI capability validation.
- Preserve omission/clear semantics in explicit MCP edits, native recurrence,
  post-write verification and uncertain-write reconciliation.
- Do not implement an extra batch engine, global task cache or generic API tool.
  Delegated replanning may use bounded sequential edits and report each result.

## Environment and verification

Inspect current Dev Container configuration and Docker state before workloads;
reuse the matching running container or start it under AGENTS.md. Host work is
limited to files/Git/API inspection. No production tokens or task mutation tests.

Every slice runs focused package tests after its final edit. Run `task gen` for
schema changes; run `task validate`, `task test`, `task gen:check` at milestone
completion. Use isolated Vikunja 2.7 fixtures for token and native-state behavior.
Run `task e2e` for release acceptance and earlier if UI/shared behavior changes.
Report historical measurements separately from current benchmark results.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Remote auth does not fit supplied API tokens and standard clients | Resolve first; document client/version compatibility; ask on concrete constraint conflict |
| Tools repeat raw Vikunja complexity | Concept coverage, workflow-oriented design and semantic fixtures; model accuracy remains unverified |
| Large tool surface confuses small models | Measure definitions; simplify overlapping actions without hiding concepts; do not infer accuracy from size |
| Shared services still contain UI assumptions | First read/write slices expose necessary extraction; no copied business rules |
| Cross-caller caches or capability replay | Two-principal tests, domain-separated grants, fresh upstream rights checks |
| Patch update erases untouched fields | Field-level omission/null tests and native-state comparisons |
| Optimizations alter freshness or recovery | Call-count regressions paired with semantic/cancellation tests |
| Model understanding unverified | User declined runtime evaluation; use researched design and deterministic tests without accuracy claims |

## Compatibility, rollout and rollback

No DB/schema migration or new persistent fields. GraphQL documentation work is
compatible with existing consumers. SDK installation is limited to the requested
dependency and required transitive modules; unrelated upgrades stay out of scope.
Choose and document optional MCP enablement in the HTTP boundary slice after auth
is settled. Do not change startup credentials for current UI deployments silently.

Do not expose unfinished write tools. Rollback disables/removes MCP wiring while
preserving UI behavior and all native task data. It does not reverse user-requested
writes already completed through MCP. Commit, push, release and deployment require
separate user instruction; this plan performs none of them.

## Open acceptance decisions

- Complete supported client/token matrix (T01); manual Bearer is approved and
  native MCP OAuth is unsupported. Initial isolated read-only/revocation tests pass.
- Model-runtime evaluation is explicitly out of scope by the user's 2026-11-09
  clarification. T21 now covers sourced design and deterministic contract checks.
- Numerical resource budgets based on measurements (T03/T22), not guesses.

Plan approval includes the custom Bearer implementation. It does not approve a
new issuer, persistence or a local adapter.
