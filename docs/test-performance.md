# Test resource policy

Keep test isolation, browser coverage and diagnostics when tuning the runners.
Measure the same workload before and after; do not equate fewer checks with an
optimization.

## Runner decisions

- Vitest uses `threads` with at most four workers, capped by
  `os.availableParallelism()` on smaller runners. File isolation stays enabled.
  This trades a small unit-run latency increase for substantially lower sampled
  process-tree RSS on many-core machines.
- Playwright retains one worker and sequential scenario ordering. Tests mutate
  one isolated Vikunja SQLite instance; increasing workers without independent
  fixtures introduces contention and state collisions. The full matrix has one
  desktop project plus focused phone and WebKit projects. This keeps each
  behavior covered while avoiding duplicate execution at nearly identical
  desktop and tablet viewports.
- Pull requests run the compact Chromium/WebKit smoke matrix. Pushes to `main`
  and release tags run the full matrix before a production image is built or
  published. The full matrix is the release gate; the smoke matrix gives fast
  feedback without pretending to replace it.
- First-failure traces, videos and screenshots remain enabled. Retry-only video
  was measured and rejected, not adopted as an assumed improvement.
- E2E and demo builds use normal `go build`, not `go build -a`. Go's build cache
  tracks embedded asset content. Frontend generation/build still runs before Go
  compilation. Never overlap a Vite rebuild with a Go embed build.
- Keep Go's `-race -count=2 -shuffle=on` and normal package concurrency. Existing
  concurrency tests use synchronization channels and bounded negative assertions;
  their deadlines are part of the behavior, not idle sleeps to remove.
- Combobox tests wait for the previous popup to disappear before reopening it.
  A matching URL or selected label does not mean its exit animation has finished.
  Do not replace these assertions with sleeps, forced clicks or longer timeouts.

The policy tests in `tests/e2e/harness/test-policy.test.mjs` guard the worker
budget, file isolation, browser-project inventory and first-failure diagnostics.

## Reproduce measurements

Run inside the already-running Dev Container, with no competing test/build job:

```sh
# Any command: elapsed wall time and sampled descendant RSS.
node tests/e2e/harness/measure.mjs pnpm --dir frontend run test
node tests/e2e/harness/measure.mjs go test -race -count=2 -shuffle=on ./...

# Browser processes only, excluding fixture/build preparation and server siblings.
E2E_MEASURE=1 tests/e2e/harness/run.sh \
  task-discussion-controls.spec.ts task-list-size.spec.ts \
  task-discussion-rich-text.spec.ts --reporter=line

# Entire harness, including fixture servers and builds.
node tests/e2e/harness/measure.mjs task e2e

# Fast PR browser matrix.
node tests/e2e/harness/measure.mjs task e2e:pr
```

The Linux sampler uses `ps` every 250 ms and writes JSON to stderr. It propagates
command failure rather than hiding it. `peakTreeRssMiB` sums descendant RSS at
each sample: shared pages can be counted more than once, and short-lived peaks
can be missed. This is not unique physical RAM, retained heap or a leak test.
`null` means no sample was collected, not zero memory. The sampler itself and
unrelated editor/preview processes are excluded.

## Experiment ledger — 2026-10-15

Linux ARM64 Dev Container, 15 available CPUs, Node 26.11.1, Go 1.27.2.
Warm dependency/build caches; the existing preview stayed running. RSS values
below are sampled process-tree sums, not container-wide memory.

| Experiment | Before → after | Verdict |
| --- | --- | --- |
| Cached Go build instead of `-a`, three paired runs | Median 3.27 s → 0.09 s; normal builds finished below the sampling interval | Keep; no source/build step omitted |
| Vitest default forks → four isolated threads, three paired full runs | Median 1590.2 → 852.5 MiB; 0.94 → 1.28 s; all 300 tests passed | Keep; ~46% less RSS for +0.34 s |
| Go package concurrency `-p=4`, same doubled shuffled race suite | 1503.4 → 498.6 MiB; 2.44 → 4.60 s | Reject; nearly doubles runtime |
| Retry-only video, same 48 browser cases | 43.39 → 41.97 s; 1398.0 → 1419.2 MiB | Revert; no convincing speed/memory gain |
| API login + direct discussion navigation, same 48 cases | 43.39 → 69.25 s; 1398.0 → 1176.7 MiB | Revert; slower despite less RSS |
| UI login + direct discussion navigation, same 48 cases | 43.39 → 78.17 s; 1398.0 → 1181.0 MiB | Revert; keep the original navigation |
| Focused browser projects, warm full fixture | 469 → 188 executions; 563.38 → 206.82 s; 2618.2 → 2146.4 MiB | Keep; one desktop pass plus targeted phone/WebKit checks preserve browser-specific coverage without repeating equivalent viewports |
| Compact PR browser matrix, warm fixture | 44 executions; 52.04 s; 1705.0 MiB | Keep; covers high-risk Chromium flows plus PWA, mobile and WebKit editor paths before the complete main/tag gate |

The initial full baseline took 563.38 s / 2618.2 MiB but had one 45-second
combobox timeout (468 passed). Do not use that failed run to claim an overall
speedup. Trace inspection localized the test's premature popup reopening; after
waiting for each close transition, 20/20 focused mobile repetitions passed.
No scenario assertion or retry was removed for the current matrix. Only repeated
execution at equivalent tablet/desktop viewports was removed; mobile, WebKit,
PWA and timezone-specific cases remain targeted projects. These local
measurements do not predict CI hardware timings.

Final verification after review: `task gen:check`, `task validate`, `task test`
and `task e2e` passed. Frontend: 324 tests; E2E: all 188 selected scenarios in
3.4 minutes. The final browser-only sampled peak was 2146.4 MiB. The fast PR
matrix runs its 44 high-signal Chromium/WebKit cases separately; `main` and
release tags keep the complete matrix before image build/publish.

## References

- [Vitest performance and isolated worker pools](https://vitest.dev/guide/improving-performance.html).
- [Playwright recording modes](https://playwright.dev/docs/test-use-options#recording-options).
- [Go build flags and cache](https://pkg.go.dev/cmd/go#hdr-Build_packages_and_dependencies).
