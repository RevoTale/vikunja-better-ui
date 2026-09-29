# Strict quality gates and behavior-preserving refactoring

## Goal and scope

Make backend and frontend quality rules executable locally and in CI, then
refactor all handwritten code to satisfy them. Preserve public APIs, task
semantics, access controls, freshness, accessibility and user-visible behavior.
Do not commit, push, install new dependencies or start/rebuild containers without
the required authorization. Run project commands in the existing Dev Container.

The user approved this separate plan; do not modify the incomplete Skip plan in
`tasks/plan.md` or `tasks/todo.md`. Execution is tracked in
`tasks/quality-gates-todo.md`.

## Confirmed baseline

- Go 1.27.1, golangci-lint 2.13.2, Biome 2.5.14 in the running container.
- Biome's installed schema supports `noExcessiveLinesPerFile` and
  `noExcessiveLinesPerFunction`; no custom frontend size checker is needed.
- Current frontend cognitive limit is 20; agreed target is 15.
- Go currently uses standard plus selected linters; exported/package comments
  are disabled, and test functions are exempt from funlen.
- Frontend examples: `e2e/app.spec.ts` 1364 lines, `create-task-page.tsx` 400,
  `create-type-fields.tsx` 333. Go examples: `recurring_completion.go` 677,
  `recurring_completion_test.go` 663, `vikunja/api_test.go` 635.
- Last full E2E before this work: 275 passed, one Chromium video playback
  `Target crashed` failure. It is not a green baseline and must remain visible.

## Rules to enforce

### Backend tests and tools

1. Run `go test -race -count=2 -shuffle=on ./...`. Preserve failure output and
   shuffle seed; reproduce order-dependent failures with that seed. Do not
   weaken checks or add retries to disguise failures.
2. Add a non-mutating modernization gate using `go fix -diff ./...`. Fail on
   command failure or a nonempty proposed patch; the command's own exit status
   alone is not sufficient. Prove this with a deliberate failing fixture.
3. Verify gofmt simplification and goimports formatting without rewriting source
   during validation. Nonempty formatting output must fail.
4. Preserve go vet, build, generated-code reproducibility and race checks.
5. Verify linter configuration with the installed tool. Keep local/CI versions
   consistent using the existing `tools/go.mod` tool pin (CI already runs
   `go -C tools install tool`). Sea Battle's `go tool` invocation is not an
   additional validation rule; no new dependency is needed here.

### Backend lint policy

- Audit the complete installed linter inventory against Sea Battle's
  `default: all` policy. Produce a recorded enabled/excluded inventory before
  declaring parity; do not silently omit its checks.
- Enable applicable correctness, security, context/cancellation, HTTP body,
  error handling, resource lifetime, logging, testing-helper and concurrency
  checks. Preserve the currently enabled useful checks.
- Function limits: 60 lines and 40 statements. Complexity limits: cyclomatic
  15, cognitive 20. Verify reporting thresholds at the boundary rather than
  assuming every linter treats the configured number as an inclusive maximum.
- Line width: 120. Long indivisible URLs, literals, protocol examples and
  generator directives may receive narrow documented exceptions.
- Require package documentation and exported declaration documentation through
  revive. Remove presets that silently suppress those diagnostics. Comments
  describe contracts, ownership, errors or invariants rather than repeating
  names. Do not demand boilerplate for every trivial unexported helper.
- Add depguard rules from actual architecture: service must not import GraphQL
  or web transports; Vikunja client must not import service or transport layers;
  configuration/auth helpers must not depend on application workflows. Preserve
  legitimate wiring imports in cmd/server and test-specific dependencies.
- Require specific linter names and explanations for nolint directives; reject
  stale suppressions where supported.
- Audit Sea Battle's exclusions: old/new whitespace and module-guard rules must
  not both run; exhaustive struct initialization and blanket bans on interface
  returns are inappropriate for this project's small consumer interfaces and
  generated resolver contracts. Exclude only when supported by concrete evidence.
- Review redundant stylistic rules, forced test parallelism and forced external
  test packages individually. Do not force unsafe parallelism or expose private
  implementation solely to satisfy a linter.

The user approved a maximum of 500 physical lines per handwritten Go file,
including tests. Generated code is excluded. There is no aggregate package LOC
limit: architecture rules, not artificial package splits, enforce boundaries.

### Frontend lint policy

- Biome `style/noExcessiveLinesPerFile`: error, maximum 300 lines.
- Biome `complexity/noExcessiveLinesPerFunction`: error, maximum 80 body lines;
  confirm its group from the installed schema before configuration.
- Biome `complexity/noExcessiveCognitiveComplexity`: error, maximum 15.
- Count blank lines (no whitespace compression to evade limits), and do not
  exempt IIFEs. Apply to handwritten source and tests, including callbacks and
  React components. Avoid blanket JSX/test exclusions.
- Preserve recommended correctness, suspicious-code, React Hooks and a11y rules;
  audit additional supported rules for useful errors rather than enabling
  contradictory preferences. Retain a reason for `useLiteralKeys` if still needed
  with strict index-signature access.
- Preserve all strict TypeScript options. Keep formatter width 100; this is a
  formatting preference, not a hard promise to split every literal at column 100.
- Generated GraphQL/route files and CLI-generated shadcn remain excluded from
  handwritten style/size rules, not from typechecking/build/reproducibility.
- Audit test/config typecheck coverage; Playwright transpilation alone is not a
  typecheck. Add a focused test tsconfig if necessary without relaxing source flags.

### Exclusions and checks of the checks

Keep one small, explicit exception policy with rule, exact scope and reason.
No baseline-wide ignore, directory-wide suppression for product code, or raising
limits just to pass. Tests may need narrow exceptions for declarative tables or
suite containers, but first split by behavior and reuse meaningful setup.

Create regression fixtures proving each quality gate accepts a valid case and
rejects a violating case. Include size and complexity boundaries, exported and
package comments, illegal imports, unjustified suppression, formatting and
modernization. Ensure fixtures do not enter production builds or bypass the
gate they are testing. Prefer existing tools/standard library over dependencies.

## Execution order

1. Inventory supported rules and current diagnostics; record baseline and exact
   exceptions. Disable diagnostic reporting caps during inventory so the default
   per-linter output limit cannot hide work. Resolve the outstanding Go size policy.
2. Add and test modernization, formatting and shuffled-test gates.
3. Configure stricter lint rules, initially collecting the complete diagnostic
   inventory. Do not present this intermediate red state as completed work.
4. Refactor backend in small packages: config/auth, Vikunja transport, service
   task queries, service creation/editing, recurrence/repair, GraphQL, HTTP.
5. Refactor frontend by workflow: shared helpers, creation/reuse, editing,
   lists/week, discussion read/navigation, editor formatting/media, test suites.
6. Update CI, AGENTS and contributor documentation to invoke the same gates.
7. Review -> fix -> simplify -> re-review, then final complete verification.

Each slice has focused regression tests, remains compilable, and separates
responsibilities rather than introducing pass-through wrappers. Do not move
business logic into generated files to evade limits. Do not split JSX into
components that merely hide a single oversized state machine.

## Verification and completion

- New gate regression tests pass and reject intentionally invalid inputs.
- `task gen:check`, `task validate`, `task test` and `task e2e` run after final
  source/config edits. CI uses these same entrypoints.
- Use desktop/mobile Chromium and WebKit coverage already defined by the repo.
- Investigate Chromium video crash separately: distinguish browser/runtime
  failure from application behavior with evidence; no silent skip or retries.
- Run image smoke validation if build/runtime configuration is affected and
  container-launch authorization is available; otherwise report that boundary.
- Report exact commands and results; no completion claim with unresolved hard
  gates. No commit/push is included in this request.

## Sources

- https://github.com/RevoTale/sea-battle-server-v2/blob/main/Taskfile.yml
- https://github.com/RevoTale/sea-battle-server-v2/blob/main/.golangci.yml
- https://golangci-lint.run/docs/linters/configuration/
- https://biomejs.dev/linter/rules/no-excessive-lines-per-file/javascript/
- https://biomejs.dev/linter/rules/no-excessive-lines-per-function/javascript/
- Installed Biome configuration schema and installed CLI help take precedence
  over newer web documentation when their supported options differ.
