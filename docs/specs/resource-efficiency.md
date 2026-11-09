# Specification: resource-efficiency

Status: implemented, 2026-11-09. Boundary: [initiative map](semantic-api-and-mcp.md).
Policy owner: [performance.md](../performance.md); reason: [ADR-010](../decisions/0010-semantic-api-and-mcp.md).

## Objective

Make allocations, external request count, RAM and CPU part of normal engineering
across the project. Measure meaningful paths and remove demonstrated waste while
preserving business semantics. This is not a request for a cache service, a new
monitoring stack or an arbitrary latency target.

## Measurement contract

For a change affecting processing, fan-out or resource lifetime, record:

- revision, Go/tool versions, architecture, fixture size, concurrency and command;
- allocations/op and B/op for relevant in-process work;
- external request counts by operation/resource, including failed/partial paths;
- CPU profile or CPU-time evidence when computation is material;
- idle and peak process RSS under sustained representative load, plus heap/GC
  observations where needed; do not equate allocs/op or Go heap with RSS;
- response size, latency distribution and MCP definition/result size when relevant;
- before/after comparison, uncertainty and dimensions intentionally not measured.

No fixed numeric performance target is accepted yet. Establish a reproducible
baseline, then set justified per-path regression budgets. Exact call counts can
be asserted for deterministic fixtures. Small timing differences within run
variation do not justify complexity or claims of improvement.

## Required workload coverage

| Path | Representative conditions | Main measurements |
| --- | --- | --- |
| Decode/list/classify/page | Empty, ordinary page, 1000 upstream tasks, 5000 candidates, at/over current candidate cap | allocs/op, B/op, CPU, calls, response bytes |
| Day/week/recurring overview | Many projected occurrences, DST boundary, filters | CPU, allocation, repeated source reads |
| Create/edit/replan/complete | Markers present/missing, stale versions, uncertain writes, partial repair | Calls, correctness, allocations |
| Authenticated and public activity | Cold/warm valid snapshot, expiration, concurrent callers, large history | Calls, peak RSS, CPU, cache/privacy behavior |
| MCP discovery and tools | Definitions only, task page, composite view, concurrency, cancellation | Definition/result bytes, SDK overhead, calls, RSS/CPU |
| Media | Bounded large input, cancellation, slow upstream | Peak RSS, cleanup, streaming rather than materialization |

Future changes need the affected rows, not a complete benchmark campaign for
every typo or description change. Before MCP release, baseline its full lifecycle.

## Optimization rules

Reuse decoded data and stable definitions within appropriate lifetimes. Bound
fan-out, result sizes, queues and retained objects. Inspect profiles before adding
pools or complex caches. Sharing HTTP connection pools may be useful; sharing
credential-bearing clients or private in-flight results across callers is unsafe.

Preserve the existing no-TTL task freshness policy and the separate ADR-008 public
snapshot cache. Do not cache failed permission checks as successful authorization,
delay revocation visibility or remove post-write verification. Authentication and
business outcomes must remain identical before/after optimization.

Do not optimize API-call count in isolation: a larger combined fetch may cost more
RAM/CPU and delay independent results. Record such tradeoffs explicitly.

## Existing anchors and commands

Use existing benchmarks in `internal/service/list_workflow_benchmark_test.go`,
`internal/service/public_activity_benchmark_test.go`,
`internal/vikunja/client_benchmark_test.go`, and
`internal/auth/session_benchmark_test.go`. Extend focused suites as needed;
keep Go files/functions within current quality limits.

All commands below run in the matching Dev Container workspace. First use the
current Taskfile workflow to establish a valid build, then compare the same
benchmark commands and fixture revisions before and after the change:

```sh
task validate
go test ./internal/vikunja -run='^$' -bench=BenchmarkClientTaskPage -benchmem -count=5
go test ./internal/service -run='^$' -bench='BenchmarkList(ActiveTasks|Week)$' -benchmem -count=5
go test ./internal/auth -run='^$' -bench=BenchmarkSessionParse -benchmem -count=5
go test ./internal/service -run='^$' -bench=BenchmarkListActiveTasks -benchtime=5s -cpuprofile=/tmp/vbu-service-cpu.pprof -memprofile=/tmp/vbu-service-alloc.pprof -o /tmp/vbu-service-profile.test
go tool pprof -top /tmp/vbu-service-cpu.pprof
go tool pprof -alloc_space -top /tmp/vbu-service-alloc.pprof
task test
task gen:check
```

Use the existing isolated harness for sustained-load measurements; record process
VmRSS/VmHWM from Linux `/proc/<pid>/status` and container CPU/memory where available.
Specify the actual PID, workload driver and sampling interval in each result.
Do not start production traffic or expose pprof publicly. Measured MCP results and
explicit evidence limits are recorded in performance.md.

## Acceptance, compatibility and rollback

- Refresh historical baselines with reproducible evidence for affected paths;
  clearly label older values instead of overwriting their provenance.
- Request-count tests fail when duplicate upstream reads are restored; semantic
  assertions continue to pass after an optimization.
- Cancellation and concurrent-caller tests show bounded work and no data leakage.
- Resource claims name measured dimensions; missing CPU/RSS evidence stays explicit.
- Run focused tests and full Taskfile gates after the final code edit.

No database or migration. Keep optimizations individually reversible. Always
preserve correctness and freshness; ask before dependencies/services or policy
changes; never weaken limits or tests to manufacture a performance win.
