# Quality gates

This is the maintainer contract for handwritten backend, frontend and test code.
Run commands in the already-running Dev Container. Do not weaken a gate to make
a refactor pass.

## Limits and scope

| Check | Go | Frontend |
| --- | --- | --- |
| File size | 500 physical lines, including blanks/comments | Biome 300 lines, including blanks |
| Function size | 60 body lines, comments included; 40 statements | Biome 80 body lines, including blanks and IIFEs |
| Cyclomatic complexity | 15 (`gocyclo`) | Not a separate gate |
| Cognitive complexity | 20 (`gocognit`) | 15 |
| Width | 120 (`lll`) | Formatter width 100, not a hard literal limit |
| Documentation | Package and exported declarations (`revive`) | Semantic names and strict types |

Tests have the same size/complexity limits. Biome counts syntax-node spans,
not every physical comment-only line; Go file size uses a small physical-line
checker. No aggregate package LOC limit is imposed. Split modules by ownership
and responsibility, never by creating forwarding wrappers solely to satisfy LOC.

Go size checks scan the repository, excluding hidden directories, dependencies
(`vendor`, `node_modules`) and build output (`dist`). Only the standard
`// Code generated ... DO NOT EDIT.` preamble exempts a Go file. Golangci uses
strict generated detection. Biome excludes generated GraphQL, routes and
CLI-generated shadcn from handwritten lint/format rules. Those frontend files
remain typechecked and built; `gen:check` verifies reproducible generated source.

Strict TypeScript covers source, configuration and E2E. Biome recommended
correctness, React and accessibility checks remain enabled. `useLiteralKeys`
is disabled because strict index-signature access requires bracket notation.

## Architecture and Go policy

`.golangci.yml` enables all installed linters, including `gomodguard_v2`, then
explicitly excludes the rules below. Upgrading the pinned linter can add new
checks: inspect `golangci-lint linters` and resolve findings during the upgrade.

`depguard` permits command entrypoints to import only standard-library and
internal application packages. Config/auth cannot import service, GraphQL or
web; service cannot import GraphQL/web; the Vikunja client cannot import service,
GraphQL or web. Tests follow these boundaries too.

| Disabled rules | Reason |
| --- | --- |
| `gomodguard`, `wsl` | Deprecated predecessors |
| `exhaustruct`, `exhaustruct_v5` | Intentional zero values and partial update structures |
| `ireturn` | Small consumer interfaces and gqlgen factories |
| `noinlineerr`, `nonamedreturns` | Idiomatic inline checks and useful named results |
| `nlreturn`, `wsl_v5` | Mandatory blank-line placement adds noise to compact control flow |
| `cyclop` | `gocyclo` owns the cyclomatic threshold; no package average limit |
| `varnamelen`, `inamedparam`, `funcorder` | Review names and declaration organization semantically |
| `testpackage`, `paralleltest` | Private-contract tests and shared HTTP fixtures are intentional |
| `tagliatelle` | Wire names belong to Vikunja |
| `err113`, `wrapcheck`, `nilnil` | Preserve safe transport errors and nullable lookup contracts |

Only test literal checks (`goconst`, `mnd`) are excluded by path: repeated
expected values keep tests independent. Local `nolint` must name the rule and
explain the invariant. Stale suppressions are rejected by `nolintlint`. There
are no broad product-code or test complexity exemptions.

## Sea Battle parity

Compared with the [Sea Battle lint policy](https://github.com/RevoTale/sea-battle-server-v2/blob/main/.golangci.yml)
and [workflow](https://github.com/RevoTale/sea-battle-server-v2/blob/main/Taskfile.yml),
this repository keeps `default: all`, its five original exclusions, width 120,
entrypoint dependency restrictions, formatting, modernization, and doubled
shuffled race tests. Additional exclusions above are deliberate adaptations,
not omitted checks. Whitespace v5 is intentionally not carried over.

`golines` settings without enabling its formatter are not a separate check;
we use gofmt/goimports plus `lll`. Installed tools are pinned in `tools/go.mod`;
`go tool` versus an installed binary is invocation, not additional validation.
Our diff gates also reject nonempty output: `go fix -diff` and formatter output
alone can otherwise exit successfully despite suggesting changes.

## Commands and failures

- `task quality:test`: positive/negative fixtures against the real tools.
- `task fix`: gofmt/goimports and Biome fixes; review the diff afterward.
- `go fix ./...`: apply modernization when `task go:fix:check` reports a patch.
- `task gen:check`: regenerate and reject generated-source drift.
- `task validate`: gate fixtures, formatting, modernization, Go file size,
  vet, golangci, Biome, strict TypeScript and both builds.
- `task test`: `go test -race -count=2 -shuffle=on ./...` and frontend unit tests.
- `task e2e`: existing isolated Vikunja fixture, mobile/desktop Chromium and WebKit.

CI calls these same tasks; do not substitute a focused success for the full
suite. Reproduce an order-dependent Go failure with its printed seed:
`go test -race -count=2 -shuffle=<seed> ./internal/service`.

When splitting tests, retain assertions, setup/cleanup scope, fixture isolation
and required ordering. The application E2E suite imports its scenario modules
through one entrypoint so completion/history checks retain their sequence.
