# ADR-012: Align the supported integration with Vikunja 2.8

## Accepted scope — 2026-11-18

The user requested alignment with the latest Vikunja release followed by a
Better UI release. The latest stable upstream release is 2.8.0. Use it as the
minimum supported server and the local/CI integration fixture, replacing 2.7.0.
This keeps the documented behavior and tested upstream version aligned.
Upgrade Vikunja before upgrading Better UI; older servers fail the startup check.

- Keep the existing REST v2 integration and stateless architecture. Do not add
  unrelated upstream features or new authentication methods.
- Native task DELETE moves active work into Vikunja's trash, recoverable in
  Vikunja for 30 days. Better UI retains its explicit confirmation and has no
  deletion Undo or trash-management UI. Recurring series stop; separate History
  snapshots remain. UI, GraphQL and MCP must describe the same behavior.
- Reminder delivery follows native task subscriptions as well as notification
  settings. Do not automatically subscribe users or add a notification service.
- Recheck MCP authorization against 2.8.0: it still requires an API token with
  `mcp:access`, rejects JWTs and does not provide native MCP OAuth. ADR-010's
  separate caller-token boundary remains unchanged.
- Pin the official CI image by digest. Verify both Linux release archives with
  the existing signing key and record archive/binary SHA-256 hashes.

## Acceptance

Reject 2.7.1 and prereleases at startup; accept stable 2.8.0 and newer. Run the
full quality and browser suites with 2.8.0, including recurrence, reminders,
deletion, permissions and MCP. Verify production-image smoke checks before
publishing through the existing release pipeline. Record the final full-suite
and image results in the release pull request and its CI checks; source
inspection alone is not runtime verification.

## Verification — 2026-11-18

- Verified both official Linux archives against the existing signing-key
  fingerprint; recorded archive and extracted-binary digests. Confirmed the
  multi-platform image digest against Docker Hub.
- `task validate`, `task test` (374 frontend tests and twice-shuffled Go race
  suites), `task gen:check` and focused adapter/MCP/harness tests passed locally.
- Eight native 2.8.0 browser/MCP scenarios passed. A subsequent deletion check
  confirmed the task is absent from active reads but present in native trash,
  with its separate recurring History snapshot preserved.
- Independent review found no actionable defects. Notification delivery and
  production deployment are outside these local checks.
- The initial full browser run passed 233/234 cases; the loading-state test
  replaced an interception handler while it was still running (`Route is
  already handled`). Both handler transitions now wait for outstanding calls
  with Playwright's `unrouteAll({ behavior: "wait" })`, matching existing test
  conventions. All loading/error assertions are retained; final reruns belong
  to the release verification above.
- The next full run exposed additional timing-dependent assertions: the
  recurring-overview setup now waits for the post-login Today heading; the
  navigation check matches Today exactly rather than also matching Finish
  today; the slow-refresh check holds the response until its loading assertions
  finish instead of assuming a 1.2-second delay remains visible long enough.

## Sources and contracts

- [Official release](https://github.com/go-vikunja/vikunja/releases/tag/v2.8.0)
- [Release changes](https://vikunja.io/changelog/vikunja-2.8.0-was-released/)
- [Native task routes](https://github.com/go-vikunja/vikunja/blob/v2.8.0/pkg/routes/api/v2/tasks.go)
- [Native MCP handler](https://github.com/go-vikunja/vikunja/blob/v2.8.0/pkg/modules/mcp/mcp.go)
- [Current application contract](../specs/mvp.md#deleting-an-active-task)
- [Reminder contract](../specs/task-reminders.md)
- [MCP contract](../specs/mcp-interface.md)

Rollback Better UI to the previous image if necessary; this change adds no
application persistence or data migration. Upstream downgrade safety is outside
this client release and must follow Vikunja's own upgrade documentation.
