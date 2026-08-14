# Go performance budget

The Go service is intentionally small and stateless. Optimize measured request
paths instead of adding caches or changing Vikunja semantics.

## Current baseline

Measurements were taken in the Linux arm64 Dev Container with Go 1.26.5. The
current app binary used 9.76 MiB RSS while idle. RSS is the relevant
physical-memory metric for Go; VSS includes large virtual address-space
reservations and is not a useful allocation target.

The benchmarks use representative task payloads and must remain in the test
suite:

```sh
go test ./internal/vikunja -run=^$ -bench=BenchmarkClientTaskPage -benchmem -benchtime=10x -count=5
go test ./internal/service -run=^$ -bench=BenchmarkListActiveTasks -benchmem -benchtime=20x -count=5
go test ./internal/auth -run=^$ -bench=BenchmarkSessionParse -benchmem -benchtime=10000x -count=5
```

Median results from the optimization baseline and the current implementation:

| Path | Before | Current | Result |
| --- | --- | --- | --- |
| Decode a 1000-task Vikunja page | 7.70 ms, 4,890,864 B/op, 6,112 allocs/op | 5.98 ms, 3,432,990 B/op, 6,089 allocs/op | 29.8% fewer allocated bytes; timing remains workload-sensitive |
| Build and page a 5000-task active list | 6.12 ms, 7,717,132 B/op, 13 allocs/op | 1.49 ms, 340,194 B/op, 9 allocs/op | 95.6% fewer allocated bytes and 75.7% lower benchmark time |
| Verify a session cookie | 2.15 us, 1,912 B/op, 21 allocs/op | 1.93 us, 1,848 B/op, 20 allocs/op | one allocation and 64 bytes removed per authenticated request; timing is within normal variance |

Real RSS depends on concurrent requests and Vikunja response sizes. The client
rejects each upstream response body above 4 MiB, and active views reject more
than 10,000 candidate tasks. These are safety bounds, not a promise that every
allowed input fits a fixed small memory limit.

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
| Use `bytes.Reader` for decoded session and capability payloads | Removed one session allocation without changing token formats | Kept |
| Replace URL string join and parse with `URL.JoinPath` | Only a few hundred bytes changed on a 3.4 MiB operation; timing stayed inside noise | Reverted |
| Use `encoding/json/v2` | Go 1.26 still marks it experimental and outside the Go 1 compatibility promise | Rejected |

Re-run the same benchmark before and after each future optimization. Revert
changes whose improvement stays within measurement noise.
