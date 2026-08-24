# Go performance budget

The Go service is intentionally small and stateless. Optimize measured request
paths instead of adding caches or changing Vikunja semantics.

## Current baseline

Measurements were taken in the Linux arm64 Dev Container with Go 1.26.6. The
current app binary used 9.76 MiB RSS while idle. RSS is the relevant
physical-memory metric for Go; VSS includes large virtual address-space
reservations and is not a useful allocation target.

The benchmarks use representative task payloads and must remain in the test
suite:

```sh
go test ./internal/vikunja -run=^$ -bench=BenchmarkClientTaskPage -benchmem -benchtime=10x -count=5
go test ./internal/service -run=^$ -bench=BenchmarkListActiveTasks -benchmem -benchtime=20x -count=5
go test ./internal/service -run=^$ -bench=BenchmarkListWeek -benchmem -count=5
go test ./internal/auth -run=^$ -bench=BenchmarkSessionParse -benchmem -benchtime=10000x -count=5
```

Median results from the optimization baseline and the current implementation:

| Path | Before | Current | Result |
| --- | --- | --- | --- |
| Decode a 1000-task Vikunja page | 7.70 ms, 4,890,864 B/op, 6,112 allocs/op | 6.38 ms, 3,432,698 B/op, 6,087 allocs/op | 29.8% fewer allocated bytes; timing remains workload-sensitive |
| Build and page a 5000-task active list | 6.12 ms, 7,717,132 B/op, 13 allocs/op | 1.63 ms, 341,627 B/op, 22 allocs/op | 95.6% fewer allocated bytes; bounded parallel page scheduling costs about 1.4 KiB per list |
| Group a 5000-task current Week response | — | 4.42 ms, 6,024,202 B/op, 49 allocs/op | Baseline includes the 5000 task copies retained in the returned seven-day view |
| Verify a session cookie | 2.15 us, 1,912 B/op, 21 allocs/op | 1.96 us, 1,848 B/op, 20 allocs/op | one allocation and 64 bytes removed per authenticated request; timing is within normal variance |

Real RSS depends on concurrent requests and Vikunja response sizes. The client
rejects each upstream response body above 4 MiB, and active views reject more
than 10,000 candidate tasks. These are safety bounds, not a promise that every
allowed input fits a fixed small memory limit.

## Task-loading request graph

Task data has no server-side TTL cache. Every list query reaches Vikunja, while
Apollo may keep the previous page visible during the mandatory background
refresh. A failed refresh is shown explicitly; cached rows are never presented
as a successful fresh response.

The backend minimizes critical-path waits:

- app-session route guards validate the signed cookie without calling Vikunja;
- user, projects, and Jobs labels start concurrently;
- an unfiltered task request starts as soon as the user timezone and any
  required Jobs labels are available, without waiting for projects;
- project-filtered and Unscheduled views wait for projects because validation
  or project-title sorting requires them first;
- active-task page 1 establishes the authoritative total, then pages 2 through
  N load with at most four concurrent requests and are assembled in page order;
- identical user, project, or label reads overlap into one upstream request only
  while that request is in flight. The final departing caller cancels the
  upstream request, and the result is discarded immediately, so the next
  request reads fresh Vikunja data.

A typical Today view therefore makes three Vikunja calls (`user`, `projects`,
and one `tasks` page), with metadata overlapped rather than serialized. Jobs
also needs `labels`. More task calls occur only when Vikunja reports additional
pages; no task is fetched individually.

At `APP_LOG_LEVEL=debug`, each upstream call records its HTTP method, coarse
resource, duration, and success state. Calls taking at least 500 ms and failures
are warnings at every log level that includes warnings. Tokens, filters, query
strings, task IDs, titles, and descriptions are never logged.

## Runtime limits

Set a container memory limit, then set Go's `GOMEMLIMIT` 5–10% below it. The
headroom covers memory the Go runtime does not account for. For example, a
128 MiB container can start with `GOMEMLIMIT=115MiB`; lower it only after
observing representative peak RSS and GC CPU. `GOMEMLIMIT` is a soft runtime
limit, not an application configuration variable.

Go 1.26 already derives `GOMAXPROCS` from Linux cgroup CPU limits. Do not add an
automatic `GOMAXPROCS` dependency or hard-code it in the application.

Do not expose `net/http/pprof` on the public server. Collect CPU and allocation
profiles from the checked-in benchmarks, or add a separately protected local
diagnostic listener only as an explicitly reviewed change.

## Experiment ledger

| Experiment | Result | Decision |
| --- | --- | --- |
| Stream bounded Vikunja JSON directly into `json.Decoder` | Removed `io.ReadAll` from the allocation profile and reduced decode bytes/op by 29.8% | Kept |
| Materialize active-list candidates page by page | Avoided holding a second full copy of all Vikunja tasks | Kept |
| Sort compact candidates and copy only the requested page | Reduced the active-list benchmark to 340 KiB/op and 1.49 ms | Kept |
| Load active-task pages 2 through N with bounded concurrency | Adds about 1.4 KiB and 13 small allocations to a 5000-task list, but removes sequential network waits while preserving ordered, all-or-nothing results | Kept |
| Filter Week candidates in Vikunja before pagination | Current and past weeks fetch only their due range; future weeks add earlier recurring sources through `repeat_after > 0` | Kept; verified against Vikunja 2.5 REST API v2 |
| Group Week pages directly instead of copying all tasks into an aggregate slice | Keeps bounded concurrent page loading while removing a second full task array and intermediate candidate list | Kept |
| Coalesce identical metadata reads only while in flight | Concurrent GraphQL/session work shares an upstream call without retaining data after completion | Kept; zero TTL |
| Add a server-side TTL task cache | Would reduce repeat traffic but could show completed or newly scheduled tasks as current | Rejected; Apollo performs a mandatory background refresh instead |
| Use `bytes.Reader` for decoded session and capability payloads | Removed one session allocation without changing token formats | Kept |
| Replace URL string join and parse with `URL.JoinPath` | Only a few hundred bytes changed on a 3.4 MiB operation; timing stayed inside noise | Reverted |
| Use `encoding/json/v2` | Go 1.26 still marks it experimental and outside the Go 1 compatibility promise | Rejected |

Re-run the same benchmark before and after each future optimization. Revert
changes whose improvement stays within measurement noise.
