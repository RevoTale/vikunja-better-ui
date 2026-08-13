# Spec: Vikunja Better UI MVP

Status: Accepted on 2026-08-12.

Product authority: `docs/ideas/recurring-task-client.md`.

This specification retains the accepted exact `job` label and introduces the
reserved `vbu:date-only` and `vbu:recurrence-history` markers. Vikunja has no
native all-day flag and retains only the latest completion time when it renews
a recurring task in place.

## Objective

Build a stateless, responsive alternative Vikunja client for one configured app
user. The client must make daily work, recurring task creation, recurring task
completion, and duration-based jobs faster and more predictable than the
standard client.

The application is successful when the user can:

1. Log in with app credentials configured through environment variables.
2. See overdue and due-today work across all accessible Vikunja projects.
3. Narrow relevant views to one project without losing URL state.
4. Create one-time, recurring, and job tasks through small purpose-built forms.
5. Complete a recurring occurrence with one click, observe one renewed schedule
   in Vikunja, and retain a completed history snapshot in Vikunja.
6. Complete one-time tasks and jobs with a short Undo opportunity.
7. Inspect recent completed tasks and a read-only diagnostic subset of the real
   Vikunja task fields.
8. Use the same flows comfortably on phone, tablet, and desktop.

Vikunja remains the only task store. This application stores no tasks,
preferences, completion history, sessions, or recurrence series in a database.

## Scope

### Included

- App login and logout.
- Today, This week, This month, Jobs, Unscheduled, and History views.
- All-project and single-project filtering.
- One-time, recurring, and job creation.
- Task details and read-only Extended diagnostics pages.
- One-click completion and the agreed Undo behavior.
- Responsive light and dark UI based on the exact TweakCN Zen Inspired Theme.
- Real Vikunja API v2 integration, tests, CI, container image, and automated
  releases.

### Excluded

- Vikunja administration or general feature parity.
- Local persistence or offline mutation queues.
- Comments, attachments, assignees, teams, permissions management, dashboards,
  calendar views, timelines, and task-to-task relations.
- Editing arbitrary Vikunja fields.
- Statistics beyond the simple completed-task history.
- Vikunja username/password authentication.
- Multiple app users, roles, password reset, or cross-device session revocation.

## Architectural decisions

### Request path

```text
Browser React UI -> same-origin Go GraphQL API -> Vikunja REST API v2
```

- The Go binary embeds and serves the Vite static build with SPA fallback.
- The browser sends application requests only to `/graphql` on the same origin.
- Operational probes use `/healthz` and `/readyz`; they are not application
  data APIs.
- Only the Go backend receives `APP_VIKUNJA_API_TOKEN`.
- The backend uses the configured token only as a Bearer token for Vikunja.
- No server-side rendering is added.

### Why GraphQL remains useful here

GraphQL is the browser contract, not a pass-through copy of Vikunja. It provides
small action-oriented inputs, stable task classifications, normalized error
semantics, and typed results that Apollo can cache. The Vikunja adapter owns
REST verbs, pagination envelopes, snake_case fields, and upstream errors.

### Version policy

Use these stable baselines:

- Go 1.26, updated to the latest supported patch release.
- Vikunja 2.5.0 as the only supported integration and E2E fixture version.
- Vikunja REST API v2 exclusively. Do not add v1 fallbacks or compatibility
  branches.
- React 19.
- TypeScript 5.x with strict compiler options.
- Vite's current stable major at scaffold time; no beta or release candidate.
- Tailwind CSS 4.
- Apollo Client 4.
- TanStack Router 1.x.
- GraphQL 16.x.
- GraphQL Code Generator CLI 7 with `typescript-operations` 6 and the client
  preset 6.
- Biome 2.
- Vitest's current stable major at scaffold time.
- Playwright 1.x.
- `gqlgen` 0.17.x and `golangci-lint` 2.x.
- Node.js 24 LTS and the current stable pnpm major.

Resolve exact patch versions during the scaffold slice, review them, then pin
them in `go.mod`, `go.sum`, `frontend/package.json`, `pnpm-lock.yaml`, the Dev
Container, CI, and test-download metadata. Never use `latest` in a reproducible
CI or release path.

## Approved dependency set

Approval of this specification approves adding only the following dependency
families. Exact stable versions are pinned as described above.

### Backend

- `github.com/99designs/gqlgen` for the required GraphQL server and generation.
- Go standard library for HTTP, configuration, cookies, cryptography, rate
  limiting, embedding, logging, and tests.

No session, router, validation, logging, or HTTP-client framework is required.

### Frontend runtime

- `react`, `react-dom`.
- `@apollo/client`, `graphql`, `rxjs` as required by Apollo Client 4.
- `@tanstack/react-router` and its stable Vite router plugin/code generator.
- `tailwindcss`, `@tailwindcss/vite`.
- Packages generated or directly required by selected shadcn/ui components,
  including Base UI or Radix primitives, `class-variance-authority`, `clsx`,
  `tailwind-merge`, and `lucide-react` only when the generated components use
  them.

### Frontend development and tests

- `typescript`, `vite`, and the official stable React Vite plugin.
- `@graphql-codegen/cli`, `@graphql-codegen/client-preset`, and
  `@graphql-codegen/typescript-operations`.
- `@biomejs/biome`, `vitest`, `@playwright/test`, and
  `@axe-core/playwright`.
- Type packages required by the selected runtime packages.

Do not add a form, schema-validation, date, state-management, CSS-in-JS, or
component framework unless implementation proves native React, GraphQL input
validation, Go time handling, Apollo, and shadcn composition insufficient. Such
an addition requires separate approval.

## Product data model

### Task kinds

- `RECURRING`: Vikunja recurrence fields are set, or the task is completed and
  has an exact-title `vbu:recurrence-history` label.
- `JOB`: no recurrence or recurrence-history marker exists and a Vikunja label
  with exact title `job` is attached.
- `ONE_TIME`: no recurrence, recurrence-history marker, or exact-title `job`
  label is present.
- A task is `INVALID` when it combines recurrence with `job`, combines a
  recurrence-history marker with recurrence or `job`, or has a
  recurrence-history marker while incomplete. Invalid tasks are diagnostic-only
  and cannot be completed in this app until corrected in Vikunja.

Marker labels are classified by exact title. If several labels have the same
marker title, any of them classifies a task and the lowest existing ID is the
canonical label for new attachments. If none exists, an instance creates one;
concurrent duplicate creation remains harmless because future requests choose
the lowest ID and recognize every exact-title duplicate. The app never deletes
or merges user labels automatically.

Labels are user-controlled Vikunja data. Renaming or removing `job`,
`vbu:date-only`, or `vbu:recurrence-history` intentionally changes how the next
read classifies that task; without local persistence there is no reliable way
to infer a former marker. Extended diagnostics exposes current label IDs and
titles so this is debuggable.

### Date-only convention

Vikunja 2.5.0 has due date-times but no native date-only flag. To retain the
accepted date-only UX without local storage:

- The app attaches the reserved Vikunja label `vbu:date-only` when a task is
  created with a date and no time.
- The stored due timestamp is the final representable second of that date in
  the Vikunja user's IANA timezone.
- The app hides the synthetic time and sorts the task in the date-only group.
- Removing the label in Vikunja makes the timestamp an ordinary timed due date.
- Existing tasks without this label are timed, including tasks at midnight or
  23:59:59. The app does not guess.
- When Vikunja renews a date-only recurring task in place, the backend verifies
  the renewed schedule, preserves the marker, and normalizes its due time to the
  end of its calculated local date if necessary.

This convention keeps all durable state visible in Vikunja and avoids an
ambiguous timestamp heuristic.

### Dates and timezone

- Vikunja user settings are authoritative for timezone, week start, and default
  project.
- A missing or invalid timezone blocks date-sensitive views with an actionable
  message to configure the Vikunja user; the browser timezone is not silently
  substituted.
- GraphQL accepts separate `LocalDate`, `LocalTime`, and `LocalDateTime` scalar
  values for form inputs. The backend converts them using the Vikunja timezone.
- A nonexistent daylight-saving wall time is rejected.
- An ambiguous repeated wall time is rejected with a request to choose another
  time. The backend never silently chooses one offset.
- All timestamps returned to the browser are RFC 3339 instants plus the
  authoritative IANA timezone needed for display.

### Priority

Expose Vikunja priority as an integer rather than inventing an incompatible
enum. Validate the exact supported range against the pinned instance OpenAPI
schema. The UI maps the supported values to human-readable labels and preserves
the raw value in Extended diagnostics.

## Routes and URL state

TanStack Router owns a typed route tree and validates every search parameter.
Invalid values are replaced with safe defaults instead of reaching GraphQL.

```text
/login?returnTo=<validated-internal-url>
/today?project=all&page=1
/week?project=all&page=1
/month?project=all&page=1
/jobs?project=all&page=1
/unscheduled?project=all&page=1
/history?project=all&page=1
/tasks/new?type=one-time|recurring|job&returnTo=<validated-internal-url>
/tasks/:id?returnTo=<validated-internal-url>
/tasks/:id/extended?returnTo=<validated-internal-url>
```

- `/` redirects to `/today` when authenticated and `/login` otherwise.
- Missing default query values may be omitted from the visible URL.
- `project=all` means no project restriction; otherwise it is a positive
  Vikunja project ID accessible to the configured token.
- `page` is a positive integer selecting one result page. Numbered pagination
  writes it to the URL so refresh and Back restore the selected page.
- `returnTo` must decode to an allowlisted relative application URL. Absolute,
  protocol-relative, malformed, login, and external destinations are rejected.
- Browser history and router scroll restoration preserve list position where
  available.
- Unscheduled project collapse state remains local and is intentionally not in
  the URL.

## List behavior

### Shared behavior

- Default project scope is all accessible projects.
- Page size is 30. Previous, numbered, and Next controls update `page` in the
  URL.
- Each response includes `page`, `pageSize`, `totalItems`, `totalPages`, and
  `hasMore`.
- For Today, This week, This month, Jobs, and Unscheduled, global ordering is
  computed only from a complete matching set. The backend
  first reads the upstream total and fetches all matches only when the total is
  at most 10,000. Above that cap it returns no task rows, `isComplete: false`,
  and a typed `RESULT_SET_TOO_LARGE` issue asking the user to select a project
  or narrower scope. It never presents an incorrectly sorted partial page.
- The 10,000-match maximum is a deliberate MVP product limit and part of spec
  approval. Direct-state equality is guaranteed within it. Raising it or
  adding external sorting requires explicit resource targets and a spec change.
- Every list has loading, empty, error, incomplete-result, and success states.
  An upstream interruption before the full bounded set is fetched returns zero
  rows, `isComplete: false`, and `UPSTREAM_PARTIAL`; partial data is never
  presented as correctly globally sorted.
- Task rows use the same semantic kind, priority, project, due, and completion
  controls in every view.

### Today

Include incomplete tasks due at or before the end of the current local day,
including jobs. Sort in stable groups:

1. Overdue: priority descending, due timestamp ascending, title ascending, ID
   ascending.
2. Timed today: due timestamp ascending, priority descending, title ascending,
   ID ascending.
3. Date-only today: priority descending, title ascending, ID ascending.

Overdue state is computed from the real due timestamp. The `date-only` end-of-
day convention prevents date-only tasks from becoming overdue during their due
day.

### This week and This month

- Include incomplete tasks due from the beginning of the relevant period
  through its end, plus earlier overdue tasks.
- Use Vikunja `week_start` for This week.
- Group overdue first, then order remaining tasks by due timestamp, priority,
  title, and ID.
- Keep these views unified across projects.

### Jobs

- Include every incomplete valid job in project scope.
- Sort overdue first, then scheduled start time, priority, title, and ID.
- A job also appears in the date scope containing its due date.

### Unscheduled

- Include incomplete tasks with no due date.
- Group by project, ordered by project title then project ID.
- Within a project, order priority descending, title ascending, ID ascending.
- Each project group is collapsible.

### History

- Include completed one-time tasks, completed jobs, and completed recurring
  snapshots marked `vbu:recurrence-history`. An invalid marked task remains
  visible with the `INVALID` diagnostic marker instead of disappearing.
- Sort by `doneAt` descending, then ID descending.
- Show completion time, title, kind, project, priority, and scheduled due date
  or time when present.
- Show 30 items per page with numbered pagination.
- History does not use the active-list 10,000-match materialization limit. It
  requests the selected Vikunja page in authoritative `doneAt` descending
  order. A failed upstream page fails the query without presenting misleading
  partial history. The runtime entry gate must prove this server-side order and
  stable tie-breaker against the pinned API before History implementation.

## Creation workflows

### Shared fields

Every creation form includes title, optional description, project, and priority.
Project defaults to the Vikunja user's default accessible project. If none is
configured or the default is inaccessible but other projects exist, selection
is required. If the token exposes no accessible project, creation is blocked by
an actionable empty state.

- Title: trimmed, 1 through the Vikunja-supported maximum length.
- Description: optional plain text/Markdown passed through without rendering
  raw HTML in this app.
- Project: positive accessible Vikunja project ID.
- Priority: integer in the upstream-supported range.
- Submitting is disabled while the same form request is in flight.
- A successful create navigates to task details with the originating URL
  retained in `returnTo`.

### One-time task

Additional fields:

- Optional due date.
- Optional due time, enabled only with a due date.

No due date creates an Unscheduled task. A due date without a time uses the
`date-only` convention.

### Recurring task

Additional fields:

- First due date, default today.
- Optional due time.
- Positive repeat interval.
- Unit: `DAY`, `WEEK`, or `MONTH`.
- Mode: `FROM_COMPLETION` or `SCHEDULED_CYCLE`, defaulting to
  `FROM_COMPLETION`.

The adapter maps this small contract to fields proven by the pinned Vikunja
2.5.0 OpenAPI schema and runtime tests. Unsupported combinations are rejected
before any write.

### Job

Additional fields:

- Start local date and time.
- Positive duration in minutes.
- Positive completion window in minutes, default 60.

Computed Vikunja fields:

```text
start_date = entered start
end_date   = start_date + duration
due_date   = end_date + completion window
labels     = existing labels + job
```

The duration and completion window are bounded to values that cannot overflow
Vikunja timestamps. A job is one-time and never receives recurrence fields.

### Marker-dependent creation and recovery

Marker labels are resolved or created before task creation. The backend then
creates one task and attaches the resolved marker IDs. Vikunja does not promise
an atomic transaction across these requests, so the mutation contract exposes
partial success instead of pretending it cannot happen:

- A confirmed task create plus failed marker attachment returns the created
  task, the missing marker kinds, and `REPAIR_REQUIRED`.
- The UI navigates to that task's recovery state. It must not repeat task
  creation.
- `repairTaskMetadata` is an idempotent state machine. It fetches the current
  task, skips already-satisfied steps, and performs one conditional upstream
  write at a time. Each successful intermediate write produces the new ETag.
- If a later step fails, the payload reports the remaining work and returns a
  newly signed capability bound to the new ETag. Retrying continues from that
  state; it never repeats a satisfied write or task creation.
- A concurrent unrelated task change returns `CONFLICT`. Refetch and explicit
  user retry are required; the backend does not overwrite the change.
- The backend and Apollo never automatically retry a task-creation POST. If the
  browser loses the GraphQL response, the UI reports an unknown outcome and
  requires a list refresh before the user can intentionally submit again.

Exactly-once task creation cannot be guaranteed across an unknown transport
outcome because Vikunja v2 does not document idempotency keys. The guarantee is
therefore: one task per confirmed create request, no automatic POST retry, and
repair without recreating the task.

## Completion workflows

### One-time tasks and jobs

1. Send one completion mutation with the task ID and expected kind.
2. Disable only that row while the mutation is pending.
3. On confirmed success, remove it from incomplete lists and show Undo for
   eight seconds.
4. The completion result includes a signed, single-purpose Undo capability
   bound to session ID, task ID, task kind, completion timestamp, upstream ETag,
   and a 30-second expiry. This wider server window tolerates network latency
   while the UI remains short.
5. `undoTaskCompletion` requires that capability, fetches current upstream
   state, verifies the task is still the same non-recurring completed
   occurrence, and uses JSON Patch `test` operations for `done` and `done_at`
   before reopening it. A changed task returns `CONFLICT`; Undo never reopens a
   different completion.
6. Successful Undo returns the full task needed to restore Apollo caches.

### Recurring tasks

Vikunja 2.5.0 renews a recurring task in place: the task keeps its ID, receives
a new due date, returns to `done=false`, and overwrites its single `done_at`
value. It exposes no occurrence-history or audit API. Therefore completion uses
native renewal for schedule safety and writes a separate archival occurrence to
Vikunja for History.

1. Read the live recurring task and its recurrence rule, labels, and dates.
2. Send one native Vikunja completion request as a JSON Patch containing
   atomic `test` operations for the expected task state. Never create the next
   schedule manually. A failed test returns `CONFLICT`. Vikunja 2.5.0 accepts
   stale `If-Match` values on this route, so ETags are not a correctness guard.
3. Refetch and verify that the same task ID is incomplete, `done_at` records the
   new completion, and its due date advanced according to the selected mode.
4. Normalize the renewed live task's date-only due time when required.
5. Create one incomplete snapshot in the same project from the pre-completion
   title, description, priority, due, start, end, and ordinary labels. The
   snapshot has no recurrence: `repeat_after=0` and `repeat_mode=0`.
6. Attach `vbu:recurrence-history`, then complete the snapshot with an atomic
   JSON Patch. Creating it with `done=true` is invalid because Vikunja 2.5.0
   leaves `done_at` empty on task creation. Store a signed deterministic
   completion key in a preserved HTML comment so a lost response can be
   reconciled against Vikunja before any retry. The key contains no secret or
   task content. Snapshot reads and writes use HTML format because Vikunja's
   Markdown conversion removes HTML comments.
7. Return `CONFIRMED` only after the renewed live task and completed marked
   snapshot are both proven. `completedTask` is the snapshot and
   `nextOccurrence` is the renewed live task, even though the latter retains the
   original upstream ID.

If native renewal succeeds but snapshot creation, marker attachment, or
date-only normalization is incomplete, return `CONFIRMED_REPAIR_REQUIRED` with
a session-bound repair capability. Repair first searches Vikunja for the
completion key, skips satisfied steps, and never repeats native completion. It
creates a snapshot only after proving none exists. An unknown or partial read
never authorizes creation.

The UI does not use optimistic completion, confirmation, automatic mutation
retry, or Undo for recurring tasks. It clearly reports that renewal succeeded
when only archival repair remains.

### Recurrence rule boundary

`RecurrenceRule` is a value separate from `Task`. Creating a recurring task
defines its renewal rule. Completing it asks Vikunja to advance the same live
task, while the app stores the completed occurrence as a non-recurring snapshot.
Editing a rule or changing an existing series is outside this MVP.

## GraphQL contract

The schema is action-oriented and additive. It uses named types and scalars;
generic JSON is forbidden.

```graphql
scalar DateTime
scalar LocalDate
scalar LocalTime
scalar LocalDateTime

enum TaskKind { ONE_TIME RECURRING JOB INVALID }
enum TaskScope { TODAY WEEK MONTH JOBS UNSCHEDULED HISTORY }
enum RecurrenceUnit { DAY WEEK MONTH }
enum RecurrenceMode { FROM_COMPLETION SCHEDULED_CYCLE }
enum MarkerKind { JOB DATE_ONLY RECURRENCE_HISTORY }
enum RepairStep {
  CREATE_HISTORY_SNAPSHOT
  ATTACH_JOB
  ATTACH_DATE_ONLY
  ATTACH_RECURRENCE_HISTORY
  NORMALIZE_DUE
}
enum TaskMutationStatus { CONFIRMED REPAIR_REQUIRED }
enum CompletionStatus { CONFIRMED CONFIRMED_REPAIR_REQUIRED }
enum PageIssueCode { RESULT_SET_TOO_LARGE UPSTREAM_PARTIAL }

type Session {
  authenticated: Boolean!
  csrfToken: String
  expiresAt: DateTime
  vikunjaUser: VikunjaUser
}

type VikunjaUser {
  id: ID!
  username: String!
  timezone: String!
  weekStart: Int!
  defaultProjectId: ID
}

type Project {
  id: ID!
  title: String!
  isDefault: Boolean!
}

type ProjectResult {
  items: [Project!]!
}

type Label {
  id: ID!
  title: String!
}

type RecurrenceRule {
  interval: Int!
  unit: RecurrenceUnit!
  mode: RecurrenceMode!
}

type Task {
  id: ID!
  title: String!
  description: String!
  kind: TaskKind!
  isDone: Boolean!
  doneAt: DateTime
  project: Project!
  priority: Int!
  dueAt: DateTime
  hasDueTime: Boolean!
  startAt: DateTime
  endAt: DateTime
  recurrenceRule: RecurrenceRule
  labels: [Label!]!
  isOverdue: Boolean!
  timezone: String!
}

type TaskPageIssue {
  code: PageIssueCode!
  message: String!
  projectId: ID
}

type TaskPage {
  items: [Task!]!
  page: Int!
  pageSize: Int!
  totalItems: Int!
  totalPages: Int!
  hasMore: Boolean!
  isComplete: Boolean!
  issues: [TaskPageIssue!]!
}

type TaskMutationPayload {
  task: Task!
  status: TaskMutationStatus!
  missingMarkers: [MarkerKind!]!
  remainingRepairSteps: [RepairStep!]!
  repairCapability: String
}

type CompletionPayload {
  status: CompletionStatus!
  completedTask: Task
  nextOccurrence: Task
  undoUntil: DateTime
  undoCapability: String
  repairCapability: String
  missingMarkers: [MarkerKind!]!
  remainingRepairSteps: [RepairStep!]!
}

type LoginPayload {
  session: Session!
}

type LogoutPayload {
  authenticated: Boolean!
}

type CreatorDiagnostic {
  id: ID!
  username: String!
  name: String!
}

type TaskDiagnostics {
  id: ID!
  projectId: ID!
  title: String!
  kind: TaskKind!
  isDone: Boolean!
  doneAt: DateTime
  dueAt: DateTime
  startAt: DateTime
  endAt: DateTime
  priority: Int!
  recurrenceRule: RecurrenceRule
  labels: [Label!]!
  createdAt: DateTime!
  updatedAt: DateTime!
  creator: CreatorDiagnostic
  maxPermission: String
}

input TaskListInput {
  scope: TaskScope!
  projectId: ID
  page: Int! = 1
  pageSize: Int! = 30
}

input LoginInput {
  username: String!
  password: String!
}

input CreateOneTimeTaskInput {
  csrfToken: String!
  title: String!
  description: String
  projectId: ID!
  priority: Int!
  dueDate: LocalDate
  dueTime: LocalTime
}

input CreateRecurringTaskInput {
  csrfToken: String!
  title: String!
  description: String
  projectId: ID!
  priority: Int!
  firstDueDate: LocalDate!
  dueTime: LocalTime
  interval: Int!
  unit: RecurrenceUnit!
  mode: RecurrenceMode! = FROM_COMPLETION
}

input CreateJobInput {
  csrfToken: String!
  title: String!
  description: String
  projectId: ID!
  priority: Int!
  startAt: LocalDateTime!
  durationMinutes: Int!
  completionWindowMinutes: Int! = 60
}

input CompleteTaskInput {
  csrfToken: String!
  taskId: ID!
  expectedKind: TaskKind!
}

input UndoTaskCompletionInput {
  csrfToken: String!
  capability: String!
}

input RepairTaskMetadataInput {
  csrfToken: String!
  capability: String!
}

type Query {
  session: Session!
  projects: ProjectResult!
  tasks(input: TaskListInput!): TaskPage!
  task(id: ID!): Task
  taskDiagnostics(id: ID!): TaskDiagnostics
}

type Mutation {
  login(input: LoginInput!): LoginPayload!
  logout(csrfToken: String!): LogoutPayload!
  createOneTimeTask(input: CreateOneTimeTaskInput!): TaskMutationPayload!
  createRecurringTask(input: CreateRecurringTaskInput!): TaskMutationPayload!
  createJob(input: CreateJobInput!): TaskMutationPayload!
  completeTask(input: CompleteTaskInput!): CompletionPayload!
  undoTaskCompletion(input: UndoTaskCompletionInput!): TaskMutationPayload!
  repairTaskMetadata(input: RepairTaskMetadataInput!): TaskMutationPayload!
}
```

Contract rules:

- `session` is public only to report unauthenticated state; it returns a CSRF
  token only for an authenticated session.
- Every other query and mutation except `login` requires app authentication.
- Every authenticated mutation requires the CSRF token as an input and matching
  request header.
- Task IDs and project IDs cross GraphQL as opaque `ID` strings and are parsed
  to validated positive upstream IDs only in the adapter boundary.
- `task` returns `null` only for an actual not-found result. Authentication,
  validation, permission, upstream, and ambiguity failures are GraphQL errors
  with stable extension codes.
- Mutation payloads return complete affected task objects and explicit
  completion metadata so Apollo can update or evict normalized entities.
- History and active lists share one `Task` object contract.
- Input constraints that GraphQL SDL cannot express, including positive IDs,
  bounds, due-time dependency, accessible projects, and capability validity,
  are validated once at the resolver/service boundary as defined in the
  creation and completion sections.
- `TaskPage.isComplete: false` requires at least one typed issue. Pagination
  fields and totals are zero in that state; the UI does not offer pagination
  until the issue is resolved. On a complete result, `items` contains only the
  selected page.
- `projects` is all-or-error. The backend follows the bounded Vikunja
  pagination to completion and returns no `ProjectResult` if any page fails or
  pagination is inconsistent; it never exposes an incomplete project selector.
- Nullable result fields follow invariants: authenticated sessions have all
  authenticated fields; live recurring tasks have a recurrence rule while
  recurring-history snapshots do not; confirmed recurring completion has
  `completedTask` and `nextOccurrence`; recurring completion that renewed but
  still needs archival repair has no `completedTask`; non-recurring completion
  has Undo fields; repair-required results have a repair capability.

### Task result shape

`Task.recurrenceRule` is a distinct immutable value in the browser contract.
It is present on the live recurring task and absent on its completed archival
snapshots. No GraphQL operation edits an existing rule in this MVP.

`TaskDiagnostics` is a read-only, explicitly typed allowlist containing fields
present on the real Vikunja task: task and project IDs, timestamps, done state,
priority, recurrence values, label IDs/titles, created/updated times, creator
identity subset, and upstream permission level when present. It excludes the
API token, unrelated user data, secrets, and generic raw JSON.

### Errors

Use stable `extensions.code` values:

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `CSRF_INVALID`
- `VALIDATION_FAILED`
- `NOT_FOUND`
- `INVALID_TASK_KIND`
- `CREATION_OUTCOME_UNKNOWN`
- `REPAIR_REQUIRED`
- `RESULT_SET_TOO_LARGE`
- `UPSTREAM_UNAVAILABLE`
- `UPSTREAM_REJECTED`
- `RECURRENCE_UNCONFIRMED`
- `CONFLICT`
- `INTERNAL`

Messages are safe and actionable. Upstream URLs, bodies, tokens, stack traces,
and numeric internals are logged only as sanitized structured causes and never
returned to the browser.

## Authentication and security

### Trust boundaries and assets

Trust boundaries are browser-to-Go and Go-to-Vikunja. Protected assets are app
credentials, the session signing secret, Vikunja API token, task contents, and
task mutation authority.

Primary abuse cases are credential guessing, forged sessions, CSRF completion,
malicious GraphQL input, GraphQL resource exhaustion, upstream response
confusion, token leakage through redirects/logs, and open redirects through
`returnTo`.

### Credential verification

- Load `APP_AUTH_USERNAME` and `APP_AUTH_PASSWORD` only in `internal/config`.
- Hash both configured and submitted values with SHA-256, then use constant-time
  comparison on the fixed-size hashes. Combine username and password results so
  failure timing and messages do not reveal which field matched.
- Return one generic invalid-credentials error.
- Apply a bounded in-memory per-remote-address limiter: five failed attempts per
  15 minutes, at most 4,096 address buckets, least-recently-used eviction, and
  expiry after 30 idle minutes. Successful login clears that address bucket.
- Apply the address limiter before performing credential hashing. There is no
  shared login-failure bucket that one source can monopolize. HTTP server
  concurrency and timeouts bound aggregate work; distributed denial of service
  remains a deployment/reverse-proxy concern rather than an app-wide lockout.
- Do not trust forwarded IP headers without an explicit trusted-proxy
  configuration. The MVP has none and uses the direct peer address.

### Session

- Cookie name: `__Host-vbu_session` outside local development and
  `vbu_session` locally.
- Signed stateless payload: version, issued-at, expiry, and 128-bit random
  session ID. Sign with HMAC-SHA-256 using `APP_SESSION_SECRET`.
- Undo and metadata-repair capabilities use separate HMAC purpose strings and
  bind the session ID, action, task ID, expected upstream timestamp/ETag,
  required marker/date metadata, and expiry. They disclose no credentials and
  cannot be used after logout in that browser because the matching session
  cookie is required.
- Lifetime: 30 days. Refresh only after half the lifetime has elapsed to avoid a
  `Set-Cookie` response on every query.
- Attributes: `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` outside local
  development. A `__Host-` cookie has no Domain attribute.
- Logout expires the current cookie. Restarting or rotating the session secret
  invalidates all sessions; there is no revocation list.

### CSRF and browser boundary

- Serve UI and GraphQL from one origin. Do not enable CORS.
- Accept GraphQL only as POST with `Content-Type: application/json`; cap request
  bodies at 64 KiB.
- Require an exact allowed `Origin` on every GraphQL POST. Local development
  origins are explicit configuration, never wildcarded.
- An authenticated `session` query returns an HMAC-derived CSRF token bound to
  the session ID. Apollo sends it in `X-CSRF-Token` and in every authenticated
  mutation input. The server requires both values to match.
- Login is protected by same-origin, JSON-only POST and rate limiting because no
  authenticated CSRF token exists yet.

### HTTP and upstream hardening

- Validate `APP_VIKUNJA_URL`: absolute HTTP(S), no user info, query, or fragment;
  HTTPS is required outside explicit local development.
- Disable automatic redirects in the Vikunja HTTP client so the Bearer token
  cannot be forwarded to another host.
- Set dial, TLS handshake, response-header, whole-request, idle-connection, and
  server read/write/idle timeouts.
- Validate upstream status, content type, pagination, and decoded field ranges.
- Bound upstream pages and total items per request. Inconsistent pagination is
  `UPSTREAM_REJECTED`; a result above the documented 10,000-item cap uses the
  typed incomplete-page result and never returns a misleading sorted subset.
- Authenticate all application operations before calling Vikunja.
- Apply GraphQL operation depth and complexity limits. Introspection is
  authenticated in production.
- Send restrictive security headers: CSP, HSTS in HTTPS deployments,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and
  `frame-ancestors 'none'`.
- Never render Vikunja descriptions with raw HTML.

## Frontend decisions

### Routing and server state

- TanStack Router owns path, project filter, pagination, `returnTo`, route
  validation, and scroll restoration.
- Apollo Client owns GraphQL server state. Use normalized task IDs and explicit
  mutation cache updates; refetch only when correctness is more important than
  a local cache edit, especially recurring completion.
- Keep each named `.graphql` operation beside the feature that uses it. Generate
  shared operation types and typed documents; never duplicate them manually.
- Apollo sends same-origin cookies. Logout clears the Apollo store before
  navigating to `/login`.
- Local React state is limited to form drafts, pending controls, toast timing,
  and Unscheduled collapse state.

### Components and styling

- Use shadcn/ui source components and their documented composition before
  custom primitives.
- Import the exact light and dark CSS variables from the accepted TweakCN Zen
  Inspired Theme and store them in `frontend/src/styles/theme.css`.
- Record the theme source URL and retrieval date in a comment. Theme tokens are
  reviewed as source, then committed; the runtime never fetches TweakCN.
- Tailwind CSS 4 handles utilities. Custom CSS is limited to global tokens,
  focus/accessibility fixes, and behavior impossible through component
  composition.
- Use one semantic size system for controls and one status palette. Ordinary
  controls remain neutral; overdue and error states carry emphasis.
- Use semantic HTML, visible labels, keyboard-safe controls, WCAG 2.2 AA color
  contrast, 44px mobile touch targets, and reduced-motion support.
- Phone navigation uses a compact reachable bottom or top navigation composed
  from shadcn primitives; tablet and desktop may use a sidebar when space
  permits. The information hierarchy and route contract remain identical.

### Forms and mutation feedback

- Prefer native inputs and shadcn Field/Input/Select components; no form library
  is added initially.
- Client validation improves feedback but never replaces GraphQL validation.
- Preserve entered form values after validation or upstream failure.
- Use inline field errors and a page-level error summary focused on submit.
- Use a live region for mutation success/failure and Undo availability.
- Recurring completion shows a pending state until verification finishes; it
  never disappears optimistically.

## Project structure

```text
.
|-- .devcontainer/
|-- .github/workflows/
|-- docs/
|   |-- ideas/
|   `-- specs/
|-- cmd/server/main.go
|-- internal/
|   |-- auth/
|   |-- config/
|   |-- graphql/{generated,model,resolver,schema}/
|   |-- service/
|   |-- vikunja/
|   `-- web/
|-- frontend/
|   |-- e2e/
|   `-- src/
|       |-- app/
|       |-- components/ui/
|       |-- features/{auth,history,jobs,tasks}/
|       |-- graphql/
|       |-- lib/
|       `-- styles/
|-- tests/
|   |-- e2e/harness/
|   `-- integration/
|-- AGENTS.md
|-- README.md
|-- Taskfile.yml
|-- go.mod
|-- go.sum
`-- gqlgen.yml
```

Add files and directories only when their implementation slice needs them.
Generated route, gqlgen, and GraphQL operation files are committed and checked
for drift but never manually edited.

## Code style

The preferred shape is a small typed function that validates once and delegates
one workflow:

```go
type TaskCompleter interface {
	Complete(ctx context.Context, taskID int64, expected Kind) (Completion, error)
}

func (r *mutationResolver) CompleteTask(
	ctx context.Context,
	input model.CompleteTaskInput,
) (*model.CompletionPayload, error) {
	taskID, err := parsePositiveID(input.TaskID)
	if err != nil {
		return nil, userError("VALIDATION_FAILED", "Choose a valid task.")
	}

	result, err := r.tasks.Complete(ctx, taskID, kindFromModel(input.ExpectedKind))
	if err != nil {
		return nil, mapServiceError(err)
	}

	return completionPayload(result), nil
}
```

Rules:

- Go names follow standard Go conventions; TypeScript uses PascalCase for
  components/types and camelCase for values/functions.
- Resolvers and route components orchestrate; services and feature modules own
  behavior.
- Functions have one responsibility and use early returns.
- Split a file when it contains unrelated workflows or its public purpose is no
  longer obvious. Do not manufacture wrappers to satisfy an arbitrary line
  count.
- `gofmt`, strict `golangci-lint`, strict TypeScript, and strict Biome checks are
  mandatory.
- TypeScript enables `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, and `noUncheckedSideEffectImports` where
  supported.
- Biome recommended correctness, suspicious, security, accessibility,
  performance, complexity, React, and test rules run as CI errors. Suppressions
  require a specific adjacent explanation.
- `golangci-lint` enables a reviewed strict set including correctness,
  error-handling, security, complexity, duplication, and style checks. Generated
  files are excluded by path; handwritten files are not blanket-excluded.

## Commands

`Taskfile.yml` is the public command surface. Tasks expand to pinned tool
commands inside the Dev Container:

```text
task gen
  go tool gqlgen generate
  pnpm --dir frontend exec graphql-codegen --config codegen.ts
  pnpm --dir frontend exec tsr generate

task gen:check
  task gen
  git diff --exit-code -- internal/graphql/generated internal/graphql/model frontend/src/graphql frontend/src/routeTree.gen.ts

task fix
  gofmt -w cmd internal tests
  pnpm --dir frontend exec biome check --write .

task validate
  go vet ./...
  golangci-lint run ./...
  pnpm --dir frontend exec biome check --error-on-warnings .
  pnpm --dir frontend exec tsc -b
  pnpm --dir frontend exec vite build
  go build ./cmd/server

task test:unit
  go test ./...
  pnpm --dir frontend exec vitest run

task test:integration
  go test ./tests/integration/...

task test:e2e
  go run ./tests/e2e/harness -- pnpm --dir frontend exec playwright test

task test
  task test:unit
  task test:integration
  task test:e2e

task build
  pnpm --dir frontend exec vite build
  go build -trimpath -ldflags "-s -w" -o dist/vikunja-better-ui ./cmd/server

task dev
  run the Vite development server and Go server with documented local ports
```

The scaffold must verify exact generated CLI names before committing the
Taskfile. If a pinned tool exposes a different stable command, update this spec
and Taskfile together.

## Testing strategy

### Unit tests

- Go tests live beside source and cover configuration validation, session and
  CSRF signing, login throttling, URL validation, Vikunja decoding, task
  classification, sorting, scope boundaries, DST rejection, recurrence mapping,
  and job date calculation.
- Vitest covers pure frontend route-search validation, display mapping, and
  cache helper logic. UI interaction behavior is primarily tested in a real
  browser rather than a simulated DOM.
- Use table-driven boundary cases. Tests must not depend on wall-clock time;
  inject clocks into date-sensitive services.

### Integration tests

- `httptest` verifies GraphQL authentication, cookies, CSRF, headers, request
  limits, resolver-to-service behavior, SPA fallback, and sanitized upstream
  failures.
- A fake Vikunja HTTP server verifies exact v2 methods, paths, headers, bodies,
  pagination envelopes, RFC 9457 errors, redirect rejection, and timeouts.
- Generated-code drift is a required check, not a manual review convention.

### Real Vikunja and Playwright E2E

- Pin Vikunja 2.5.0 full binaries for Linux amd64 and arm64 with URL, version,
  SHA-256, signature URL, and signing-key fingerprint.
- Verify the official signature before caching or executing the binary.
- One harness invocation creates one temporary directory, dynamic ports, SQLite
  database, files directory, test user, scoped API token, projects, labels, and
  fixtures.
- The harness starts Vikunja and the built application as child processes,
  waits on readiness, runs Playwright, terminates only its children, and removes
  only its exact temporary directory on success or failure.
- CI uses one Playwright worker. Browser projects cover representative phone,
  tablet, and desktop viewports.
- Each mutation test asserts both visible UI state and direct Vikunja API state.
- Required flows: login/logout, route restoration, project filtering, all list
  scopes, every creation type, job calculations, completion/Undo, both
  recurrence modes, same-ID native renewal, one non-recurring marked history
  snapshot, date-only normalization, history pagination, invalid mixed task,
  Extended diagnostics, loading/empty/error states, keyboard navigation, and
  automated accessibility checks.
- Production credentials are never accepted by the harness.

### Runtime entry gates

Before implementing dependent behavior, tests against the pinned binary must
prove:

1. The exact v2 task, project, user-settings, label, and history endpoints and
   token scopes from that binary's `/api/v2/openapi.json`.
2. Native completion renews the same task ID in place for both modes and
   overwrites its single `done_at`. JSON Patch `test` operations must reject a
   stale write without advancing the schedule; `If-Match` is not used as a
   guard because the 2.5.0 runtime accepts stale values.
3. Day, week, and month recurrence mappings preserve supported calendar
   semantics.
4. Labels remain on the same-ID renewed task, and a snapshot can be created
   completed with recurrence disabled, marked, and reconciled by its completion
   key without duplication.
5. User timezone, week start, default project, completion timestamp, and
   permission fields are available as assumed.
6. Reopening a freshly completed non-recurring task restores the same occurrence
   without creating another task.
7. Task creation cannot attach labels atomically; marker repair must be proven
   idempotent against a known created task. If the OpenAPI/runtime provides a
   true atomic or idempotent create mechanism, prefer it and simplify this
   recovery contract through a spec update.
8. Completed-task listing supports server-side `doneAt` descending order with a
   stable ID tie-breaker and page traversal, so History never requires loading
   the complete history into memory.

Failure of a gate changes the specification before product code is written. It
does not justify local persistence, heuristic duplicate creation, or API v1.

## CI and release

- A reusable test workflow runs generation drift, format/lint, vet, TypeScript,
  builds, unit tests, integration tests, Playwright, and production-image smoke
  tests.
- Pull requests and pushes to `main` call the same reusable workflow.
- The stable named check is configured as required in GitHub branch protection;
  repository YAML cannot enable branch protection by itself.
- Playwright traces, screenshots, and reports upload only on failure or
  cancellation and use bounded retention.
- CI uses frozen Go modules and `pnpm install --frozen-lockfile`; dependency
  lifecycle scripts are denied by default and explicitly allowlisted only when
  a reviewed dependency requires them.
- Third-party actions are pinned to reviewed immutable SHAs with version
  comments. Official GitHub actions receive the same treatment where practical.
- Release Please uses the official `googleapis/release-please-action` v4 line,
  manifest configuration, Conventional Commits, and a reviewed immutable SHA.
- Release creation depends on the complete reusable test workflow.
- After a release is created, the reviewed immutable commit SHA corresponding
  to `revotale/docker-multi-arch-release-action` v1.4.0 publishes GHCR images
  for `linux/amd64` and `linux/arm64` with the version and `latest` tags. The
  workflow comment records `v1.4.0`; the executable `uses:` value is the SHA.
- Workflow permissions are job-scoped and minimal. Release/registry credentials
  exist only in GitHub secrets.
- The production image runs as non-root, contains CA certificates and timezone
  data, exposes one HTTP port, and has no shell or build toolchain when the
  chosen stable base supports those requirements.

## Observability and operations

- Use structured JSON logs in production and readable structured logs locally.
- Include request ID, operation name, duration, status class, and sanitized
  upstream status/code. Never log GraphQL variables, credentials, cookies,
  tokens, descriptions, or task titles by default.
- `/healthz` reports process health without external calls.
- `/readyz` reports configuration validity and bounded Vikunja reachability
  without exposing failure details or credentials.
- Startup fails clearly for missing/invalid required environment values. A
  temporary unreachable Vikunja instance does not erase configuration or start
  a retry storm.

## Configuration

Required:

- `APP_VIKUNJA_URL`
- `APP_VIKUNJA_API_TOKEN`
- `APP_AUTH_USERNAME`
- `APP_AUTH_PASSWORD`
- `APP_SESSION_SECRET`

Optional with documented defaults:

- `APP_HTTP_ADDR=:8080`
- `APP_LOG_LEVEL=info`
- `APP_ENV=production`
- `APP_ALLOWED_ORIGIN`, required as an explicit HTTP(S) origin outside local
  development and used for Origin validation.

`APP_SESSION_SECRET` must decode to at least 32 random bytes. `.env.example`
contains placeholders only. Production secrets are supplied by the deployment
environment, never Vite variables.

## Boundaries

### Always

- Keep Vikunja as the only durable data source.
- Validate browser input and Vikunja responses at their boundaries.
- Keep GraphQL resolvers thin and pass `context.Context` through backend calls.
- Preserve URL-owned navigation state and unrelated working-tree changes.
- Add focused tests before or with each behavior slice.
- Run focused checks and then applicable full checks after the final edit.
- Update schema, generated files, tests, and documentation together.
- Explain and review every new dependency and lockfile change.

### Ask first

- Add a dependency outside the approved set.
- Change a public GraphQL field incompatibly.
- Change recurrence, completion, Undo, date-only, or task-kind semantics.
- Add persistence, a service, another auth method, CORS, trusted proxies, or
  another external integration.
- Change the required stack, repository structure, or release destination.
- Commit, push, publish an image, create a release, or change GitHub repository
  settings.

### Never

- Expose or log any credential, token, session secret, or cookie.
- Put Vikunja credentials or URLs containing credentials in frontend code.
- Call Vikunja from the browser.
- Use API v1 for product behavior.
- Blindly retry recurring completion, create the next recurring schedule
  locally, or give a history snapshot recurrence fields.
- Render upstream HTML unsanitized.
- Disable strict TypeScript, Biome, Go lint, security checks, or failing tests to
  make CI pass.
- Edit generated code by hand.
- Commit without explicit user instruction.

## Success criteria

- All accepted routes reload and restore their URL-owned state.
- All-project and accessible single-project scopes match direct Vikunja state.
- Today, week, month, jobs, unscheduled, and history inclusion and ordering pass
  deterministic boundary tests in the Vikunja user's timezone.
- Each confirmed creation request writes one task. Marker partial failure is
  represented and repaired against that same task without repeating creation;
  an unknown transport outcome is never retried automatically.
- Completing a recurring occurrence advances the same live Vikunja task once
  and creates one completed, non-recurring, marked history snapshot for both
  modes. Conditional writes prevent two app instances from renewing the same
  version. Snapshot repair reconciles its deterministic completion key before
  creation and never repeats native renewal.
- One-time and job completion Undo restores the same Vikunja task during the
  defined window only with a valid session-bound capability and unchanged
  upstream version.
- No application database, browser secret, API v1 request, or direct browser-to-
  Vikunja request exists.
- Authentication, CSRF, request limits, security headers, redirect rejection,
  and safe errors pass integration and browser checks.
- Phone, tablet, and desktop critical flows have no horizontal overflow and are
  keyboard accessible; automated accessibility checks have no serious or
  critical violations.
- `task gen:check`, `task validate`, `task test`, and the production image smoke
  check pass from a clean checkout in CI.
- Release Please cannot publish a release, and the Docker action cannot publish
  an image, unless the complete required test workflow succeeds.
- README and `.env.example` document installation, configuration, development,
  testing, and container usage without real secrets.

## Open technical validations

These are implementation entry gates, not unresolved product choices:

- Exact Vikunja 2.5.0 OpenAPI paths, scopes, recurrence fields, and occurrence
  identity behavior.
- Exact TweakCN theme token export and its checksum at retrieval time.
- Exact stable dependency patch versions and third-party GitHub Action SHAs.
- Whether the selected shadcn components use Base UI or Radix packages at the
  time they are generated.
- Exact production image base after confirming CA certificates, timezone data,
  non-root execution, and multi-architecture availability.

If a validation contradicts an accepted product behavior, update this spec and
request approval before continuing that behavior.

## Decision record

- TanStack Router is selected because the URL is an explicit product state
  contract and the router provides typed path/search validation and navigation.
- Apollo Client remains the only browser server-state cache; no duplicate state
  library is added.
- Native inputs and shadcn Field composition are preferred initially to avoid a
  form-library dependency for three small forms.
- Go standard-library security and HTTP primitives are sufficient for the
  single-user stateless service; extra middleware frameworks would add more
  surface than value.
- `vbu:date-only` is a reserved Vikunja label because Vikunja has no native
  all-day field and timestamp guessing is ambiguous. Jobs retain the accepted
  exact `job` label for compatibility with existing tasks.
- `vbu:recurrence-history` marks non-recurring completed snapshots because
  Vikunja 2.5.0 renews one live task in place and overwrites its prior
  completion timestamp. See `docs/decisions/0001-recurring-history-snapshots.md`.
- Page-based pagination mirrors Vikunja v2 and keeps Back/refresh semantics
  simple.
- A direct pinned Vikunja binary is preferred over Docker-in-Docker or a
  Compose sidecar because the test harness can own one isolated process and
  SQLite directory deterministically.
- Recurring completion is pessimistic because success requires proving both the
  same-ID native renewal and its completed history snapshot.

## Sources

- Vikunja API v2 semantics and instance OpenAPI authority:
  https://vikunja.io/docs/api-v2/
- Vikunja dates and native recurring completion:
  https://vikunja.io/help/dates-and-reminders/
- Vikunja maintainer explanation that due dates always include a time:
  https://community.vikunja.io/t/list-view-improvements/2674/2
- Vikunja 2.5.0 release:
  https://github.com/go-vikunja/vikunja/releases/tag/v2.5.0
- Vikunja signed binary installation:
  https://vikunja.io/docs/installing/
- gqlgen schema-first approach: https://gqlgen.com/
- TanStack Router typed search parameters:
  https://tanstack.com/router/latest/docs/framework/react/guide/search-params
- Apollo Client cookie authentication and cache reset:
  https://www.apollographql.com/docs/react/networking/authentication
- GraphQL Code Generator client preset:
  https://the-guild.dev/graphql/codegen/plugins/presets/preset-client
- shadcn/ui Vite and Tailwind CSS 4 setup:
  https://ui.shadcn.com/docs/installation/vite
- Biome linter rules and severity behavior: https://biomejs.dev/linter/
- Playwright CI workers and artifacts: https://playwright.dev/docs/ci
- Playwright web-server lifecycle: https://playwright.dev/docs/test-webserver
- Release Please GitHub Action:
  https://github.com/googleapis/release-please-action
- Go release history: https://go.dev/doc/devel/release
- Accepted TweakCN theme:
  https://tweakcn.com/themes/cmlm03etv000204lh15608kec
