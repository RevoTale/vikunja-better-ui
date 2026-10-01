# Strict quality gates execution checklist

Plan: `quality-gates-plan.md`. No commit/push authorization.

## 1. Baseline and rule inventory

- [x] Confirm matching running Dev Container and installed tool versions.
- [x] Confirm native Biome file/function size rules from installed schema.
- [x] Record existing size hotspots and known E2E failure.
- [x] Enumerate enabled/disabled Go linters against Sea Battle; document each exclusion.
- [x] Measure full diagnostics for agreed limits and test code.
- [x] Go size decision: 500 lines per handwritten file, including tests; no package LOC limit.

Acceptance: executable rules, scopes and exclusions are explicit.
Verification: installed CLI config validation and diagnostic inventory.
Dependencies: none. Files: lint configs, this plan/checklist.

## 2. Test and formatting gates

- [x] Add failing-on-diff modernization and formatting commands.
- [x] Enable repeated/shuffled race tests with reproducible seed output.
- [x] Add positive/negative regression fixtures for those gates.

Acceptance: dirty formatting/modernization fails; clean source passes without edits.
Verification: gate fixture tests and focused Go race tests.
Dependencies: 1. Files: Taskfile and focused quality-check tests/scripts.

## 3. Lint configuration and enforcement tests

- [x] Configure Go complexity, width, documentation, architecture and suppression rules.
- [x] Configure Biome 300/80/15 limits as errors.
- [x] Verify threshold boundary and generated/vendor exclusions.
- [x] Audit strict typecheck coverage of frontend tests and configs.
- [x] Add positive/negative gate tests for docs, boundaries, size and complexity.

Acceptance: real violations fail without blanket suppression; fixtures prove it.
Verification: config validation, gate tests, diagnostic report.
Dependencies: 1-2. Split into backend/frontend/gate-test slices of at most ~5 files.

## 4. Backend refactoring slices

For each package slice: add/preserve regression tests, run focused lint/tests,
review -> fix -> simplify -> re-review. Split a slice further when it spans
more than approximately five files. Preserve API and completion semantics.

- [x] Config and authentication.
- [x] Vikunja HTTP transport, pagination and media.
- [x] Task classification, queries, labels and reuse.
- [x] Creation and editing workflows.
- [x] Recurrence, history, repair and retry safety.
- [x] GraphQL resolvers and mapping.
- [x] Integrations and web handlers.
- [x] Test helpers, large suites and package documentation.

Acceptance: every applicable backend diagnostic resolved with meaningful structure.
Verification: focused package race/shuffle tests after each slice; complete backend
validation and tests at the checkpoint. Dependencies: 3.

## 5. Frontend refactoring slices

For each workflow: preserve state ownership, request cancellation, draft safety,
freshness, keyboard behavior and layout. No generated shadcn edits.

- [x] Shared helpers and application wrappers.
- [x] Creation, explicit reuse and field validation.
- [x] Editing, duration and schedule controls.
- [x] Lists, labels, weekly view and loading states.
- [x] Discussion rendering, actions and reply navigation.
- [x] Editor formatting, code and tables.
- [x] Editor media and clipboard workflows.
- [x] Split large unit/E2E suites by behavior; preserve assertions and isolation.

Acceptance: handwritten files <=300 lines, function bodies <=80, cognitive <=15;
document any narrowly justified exception. Verification: focused unit/E2E,
Biome and strict typecheck after each slice. Dependencies: 3; avoid concurrent
changes to shared GraphQL contracts and fixtures.

## 6. CI and documentation

- [x] Wire identical local/CI quality gates and verify task names.
- [x] Document rules, exception policy and correct formatter commands in AGENTS/README.
- [x] Explain test shuffle seed reproduction and generated-code treatment.

Acceptance: contributors and CI use the same enforced contract.
Verification: workflow review, Task command listing and gate regression tests.
Dependencies: 2-5. Files: Taskfile, workflow, AGENTS, README.

## 7. Final review and acceptance

- [x] Complete review -> fix -> simplification -> re-review.
- [x] Investigate existing Chromium video crash without hiding the test.
- [x] Run final `task gen:check`.
- [x] Run final `task validate`.
- [x] Run final `task test` with repeated shuffled race checks.
- [x] Run full `task e2e`: 275 passed, 1 browser-runtime failure.
- [x] Confirm no unintended API/UX behavior changes or broad exclusions.
- [x] Record exact results and any external blockers; never claim unverified completion.
- [x] Full green E2E acceptance: CI run 36789208186 passed all 320 tests at
  `24c0dff`; see [the status index](README.md). The runtime notes below are historical.

Acceptance: all agreed hard gates pass, or outstanding blockers are explicit and
the work remains incomplete. Dependencies: all preceding slices.

## Current verification checkpoint

- 12 quality-gate regression tests passed.
- `gen:check` and `validate` passed; golangci reports 0 issues.
- All Go packages passed doubled shuffled race tests; 234 frontend tests passed
  across 42 files. Shared fake-clock scope was restored after splitting suites.
- Independent backend, frontend and policy reviews found no remaining findings.
- Full E2E: 275 passed, one Chromium video failure. No assertions were removed.

## Remaining browser blocker

The installed Linux ARM64 Chromium renderer crashes with SIGILL while playing
the test WebM with Playwright video recording. The focused E2E reproduces it;
stderr reports `Received signal 4` and shared-image errors. Failures around
visibility/autoplay are fallout from the crashed page, not proof of autoplay.

A minimal page containing only `<video controls preload="metadata">`, fed the
same bytes through a data URL, reproduces `Target crashed` with recording.
Without recording, metadata loads. WebKit plays and advances currentTime with
recording. Both installed Chromium headless modes and a diagnostic
`--disable-gpu` run crash. No application/API code participates in that probe.
Shared memory is approximately 7.9 GiB, not the common 64 MiB container limit.

No checks, recording or retry policies were disabled. No dependencies or
container runtime were changed. Full acceptance needs a fixed browser/runtime
or successful verification in CI; do not report the suite as green beforehand.

Ignored diagnostic artifacts: `.cache/e2e/quality-final-e2e.log`,
`.cache/e2e/quality-video-debug.log`, `.cache/e2e/video-probe.mjs`.
Image smoke testing was not run locally: no image/runtime config changed, and
creating containers remains outside approval.
