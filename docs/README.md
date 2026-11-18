# Better UI documentation

| If you need to… | Start here |
| --- | --- |
| Configure the running application | [Configuration](../README.md#configuration), [container image](../README.md#container-image) and [.env.example](../.env.example) |
| Trace a request or diagnose an access failure | [Architecture and access](architecture.md) |
| Set up personal token login over WireGuard | [Login, migration and acceptance](specs/personal-token-login.md) |
| Work on scheduling or recurrence | [Scheduling examples](specs/task-scheduling-examples.md), [planning UI](specs/task-planning-ui-proposal.md) and [recurring Jobs](specs/recurring-jobs.md) |
| Change task editing, discussion or sharing | [Inline editing](specs/inline-task-editing.md), [discussion](specs/task-discussion.md) and [share links](specs/share-links.md) |
| Integrate a dashboard or an AI client | [Jobs HTTP API](../README.md#read-only-jobs-integration), [semantic API](specs/semantic-api-and-mcp.md) and [MCP transport](specs/mcp-interface.md) |
| Check API compatibility, resource use or a release | [Upstream API audit](specs/upstream-api-audit.md), [performance](performance.md), [quality gates](quality-gates.md) and [CI](woodpecker.md) |

## Decisions

Each ADR owns the reasoning, dates and subsequent clarifications. Follow its
linked specifications where available for behavior and acceptance checks.
Where only part of a decision has shipped, the record identifies that boundary.

| ADR | Decision |
| --- | --- |
| [013](decisions/0013-personal-token-login.md) | Use a personal Vikunja token for each browser session, including over private HTTP. |
| [012](decisions/0012-vikunja-2.8-compatibility.md) | Require Vikunja 2.8 and follow its task deletion, reminders and MCP contracts. |
| [011](decisions/0011-share-links.md) | Share links to existing pages with the recipient's own access. |
| [010](decisions/0010-semantic-api-and-mcp.md) | Expose product workflows through semantic APIs and an optional remote MCP endpoint. |
| [009](decisions/0009-task-planning-windows.md) | Model planning windows, deadlines and work sessions separately. Saved named filters are deferred. |
| [008](decisions/0008-public-activity-http-cache.md) | Serve anonymous aggregate activity through fixed, cacheable GETs. |
| [007](decisions/0007-local-task-creation-autofill.md) | Automatic task creation recall was removed. The replacement is [manual value reuse](specs/task-value-reuse.md). |
| [006](decisions/0006-recurring-jobs-use-native-renewal.md) | Normalize recurring Job schedules after Vikunja renews them. |
| [005](decisions/0005-fresh-task-loading.md) | Fetch fresh task data and overlap independent reads. |
| [004](decisions/0004-read-only-jobs-integration.md) | Give dashboards a read-only Jobs endpoint using the caller's token. |
| [003](decisions/0003-skipped-recurring-occurrences.md) | Record skipped occurrences as labeled history snapshots. |
| [002](decisions/0002-recurring-repair-capability.md) | Repair incomplete history without renewing the series twice. |
| [001](decisions/0001-recurring-history-snapshots.md) | Store recurring history as task snapshots in Vikunja. |
