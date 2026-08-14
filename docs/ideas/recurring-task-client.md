# Recurring Task Client

Status: Accepted on 2026-08-12.

## Problem statement

How might we make completing and creating recurring Vikunja tasks predictable
and fast, especially on iOS, without reproducing Vikunja's complex task editor?

## Target user

The initial product is for one configured user who already uses Vikunja but
wants a smaller, purpose-built task workflow.

## Confirmed pain

- Recurring tasks completed through iOS clients do not reliably show a renewed
  occurrence.
- Creating a recurring task in Vikunja requires repeating a complicated field
  pattern.
- Routine tasks should require fewer fields and actions.

## Proposed primary flow

1. Log in to the app.
2. See a simple task list.
3. See overdue and high-priority work first.
4. Identify each task as one-time, recurring, or job.
5. Complete a task with one clear action.
6. For a recurring task, renew it from its saved recurrence configuration.
7. Skip one recurring occurrence without losing the future series or claiming
   that the work was completed.
8. Delete an active task when it should no longer exist.
9. Create recurring tasks through a small, purpose-built form.
10. Use a separate Job tab for duration-based work.

## Confirmed task-list behavior

- Read tasks from Vikunja only. Do not store tasks, filters, preferences, or
  completion history in this app.
- Include every Vikunja project accessible through the configured API token.
- Default list project scope to All projects.
- Provide a project filter on applicable lists. Store its selection in the URL
  query so filtered views are reloadable and shareable.
- Default scope: incomplete tasks due through the end of today, including
  overdue tasks.
- Provide one-action scope controls for Today, This week, and This month.
- Calculate day, week, and month boundaries using the Vikunja user's timezone.
- Sort Today in three urgency groups:
  1. Overdue: highest priority first, then oldest due time.
  2. Due at an exact time today: earliest due time first, then priority.
  3. Date-only tasks due today: highest priority first, then title.
- Time overrides priority for timed work. A high-priority task due later must
  not hide a lower-priority task due sooner.
- Apply the same task classification markers in every scope.
- Today is the primary screen. Its main question is: "What should I do today,
  and what is due at an exact time?"
- Show due times prominently when they exist. Date-only tasks remain visible
  without inventing a time.
- Exclude tasks without a due date from Today, This week, and This month.
- Put tasks without a due date in a separate Unscheduled tab. These are the
  tasks previously described as longer-running; the term does not refer to
  start/end duration.
- Group Unscheduled tasks by Vikunja project. Render a clear separator/header
  per project and allow each project group to collapse.
- Collapse state is view-only React state unless Vikunja provides an appropriate
  setting; do not persist it in this app.
- Today, This week, and This month are unified cross-project lists. Do not split
  these scopes into project sections.
- Unscheduled alone is divided into collapsible project sections.
- An incomplete job appears in Today, This week, or This month when its due date
  falls within that scope. It also appears in Jobs. These are two views of the
  same Vikunja task, not duplicated data.

### Confirmed task-row visual hierarchy

- Center list content and limit it to `max-w-5xl` (1024px) on larger screens.
  Keep it full-width inside the normal page padding on phone and tablet widths.
- Use two semantic columns at every breakpoint: a fixed-width schedule column
  on the left and one flexible content column on the right.
- The left schedule column communicates time sensitivity:
  - overdue uses the destructive state;
  - due within two hours uses the warning state;
  - due later today uses the normal foreground;
  - date-only work uses muted text and never shows the synthetic `23:59:59`;
  - week and month rows show day/month with the exact time below when present.
- For jobs, show the work interval, such as `10:15-11:00`, in a slightly wider
  schedule column. Show the separate completion deadline as `Complete by
  12:00` in the task metadata.
- Place the priority badge directly below the schedule. Priority keeps its own
  semantic palette and label; schedule color represents urgency only.
- Put the title and completion control in the first content row, the muted
  project below them, and task kind plus ordinary labels in the final row. Use
  the same order on phone, tablet, and desktop. Long titles and badges must wrap
  within the content column instead of widening the row.
- Do not rely on color alone. Text, labels, ordering, and overdue wording must
  communicate the same states. Invalid mixed tasks remain diagnostic-only and
  do not gain a completion control.

## Confirmed history behavior

- Include a simple History tab in the MVP.
- Read completed tasks from Vikunja only.
- Show completion time, title, task type, project, priority, and the scheduled
  due time/date when present.
- Order by completion time, newest first.
- Show 30 completed tasks per page with numbered pagination.
- Keep the view simple; charts, aggregates, streaks, and other statistics are
  deferred.
- The Extended diagnostic action remains available for a history item.
- Show skipped recurring snapshots as `Skipped`, distinct from normally
  completed occurrences.
- History is read-only in this app. It never offers Delete, Skip, completion,
  Undo, or another mutation action.

## Confirmed job behavior

A job is a one-time scheduled task, not a recurring task.

Creation requires only:

- Title.
- Optional description.
- Start time.
- Duration.
- Completion window, defaulting to one hour.

The app computes the end time and any other Vikunja fields required to represent
the schedule. Creating the job creates one Vikunja task. Completing it marks
that task done; it does not renew.

The Job tab is one unified cross-project list, not grouped by project. Order
unfinished jobs by overdue state and then scheduled start time.

### Vikunja field mapping

- `title`: entered title.
- `description`: optional entered description.
- `start_date`: entered start time.
- `end_date`: start time plus duration.
- `due_date`: `end_date + completion window`. The completion window is an input
  field that defaults to one hour. After it expires, an unfinished job becomes
  overdue and enters overdue sorting.
- `done` and system-controlled `done_at`: set by normal task completion.

Vikunja's official documentation describes start and end dates as the planned
work window and the due date as the completion deadline used for overdue state
and sorting. No extra stored duration or application database is required; the
duration can be derived from `end_date - start_date` when displaying the job.

For a new integration, prefer Vikunja API v2 when the configured instance
supports Vikunja 2.5.0 only.

## Proposed MVP scope

- Simple task list.
- One-action completion.
- Visible overdue and priority states.
- Sorting by overdue state and priority.
- Clear one-time, recurring, and job markers.
- Small recurring-task creation form.
- Job tab.
- Job start time and duration handling with minimal input.
- Clean UI built with shadcn/ui and Tailwind CSS 4.
- Vikunja 2.4+ through API v2 only.

## Confirmed UI and implementation constraints

- Use the TweakCN "Zen Inspired Theme" exactly as the design-token source:
  `https://tweakcn.com/themes/cmlm03etv000204lh15608kec`.
- Preserve its light and dark theme tokens when importing it into the Tailwind
  CSS 4 and shadcn/ui setup. Follow the system color scheme automatically. Do
  not approximate the theme from screenshots.
- Prefer stable Rust-based developer tooling when it is compatible with the
  required stack and simpler than the alternative. Do not adopt alpha, beta,
  release-candidate, or nightly tooling.
- Biome satisfies this preference for frontend formatting and linting.
- Configure Biome with strict recommended rules and keep TypeScript strict,
  including unchecked indexed access and exact optional property checks.
- Use stable `golangci-lint` with a checked-in strict configuration for Go.
- Prefer small, responsibility-focused files and functions in both languages.
  Split mixed workflows early, but do not add wrappers or abstractions solely
  to meet an arbitrary line limit.
- Do not replace required tools such as Vite, pnpm, or GraphQL Code Generator
  merely to maximize Rust usage.
- Organize product code by feature. Keep task classification, date scopes,
  recurrence mapping, and job date calculation as reusable focused modules.
- Extract shared UI only when multiple features use it or the boundary is
  already stable. Avoid speculative generic abstractions.
- Prefer unmodified shadcn/ui components and composition. Keep custom CSS,
  Tailwind utility overrides, and one-off variants to the minimum required by
  the product flow and selected TweakCN theme.
- Support phone, tablet, and desktop layouts. Primary actions must remain easy
  to reach, and task information must not require horizontal scrolling.
- Define shared semantic variants and dimensions for navigation, filters,
  pagination, fields, badges, and task rows. Do not mix heights, colors, radii,
  or spacing without a product meaning.
- Use emphasis only when it communicates state. Overdue tasks are a valid
  highlighted state; ordinary filters and controls should remain visually
  consistent.
- Make routes and shareable view state URL-owned. Use URL paths for primary
  screens and query parameters for filters, date scopes, pagination, and other
  reversible view state. Do not hide navigation state only in React memory.
- Temporary interaction state such as an open dialog or expanded project group
  may remain local unless deep-linking it has clear value.
- Prefer separate semantic pages with visible Back navigation over modals,
  drawers, or sheets. Task creation, task details, and Extended diagnostics are
  pages.
- Preserve the originating list URL when navigating forward so Back restores
  its scope, project filter, pagination, and other URL-owned state. Restore
  scroll position where the router and browser history allow it reliably.
- Give future primary features their own semantic routes. Do not overload an
  unrelated route or query parameter merely to avoid adding a page.
- Use modals only for genuinely blocking confirmations or tiny transient
  interactions. No accepted MVP flow currently requires one.

## Confirmed recurrence behavior

- Use recurrence intervals supported by Vikunja, including every day and every
  N days, weeks, or months where the API supports them.
- Let the user choose how the next occurrence is calculated:
  - From completion: calculate it from the actual completion time.
  - Scheduled cycle: advance it from the configured schedule, independent of
    late completion.
- Completing an occurrence must produce exactly one renewed schedule.
- Keep every completed occurrence in history for future statistics.
- Runtime verification against Vikunja 2.5.0 proves that native completion
  renews the same task ID, overwrites its single `done_at`, and exposes no
  occurrence-history API.
- Use native same-task renewal for schedule safety. After renewal, create one
  completed archival task in the same Vikunja project, with no recurrence
  fields and the exact label `vbu:recurrence-history`.
- The archival task represents the real completed occurrence and remains in
  Vikunja for History and future statistics. The app stores no local copy.
- New recurring tasks default their first due date to today.
- The creation form may optionally set a time of day. Without a time, the task
  is due on that date without requiring another field from the user.

## Confirmed completion behavior

- Completion is always a one-click action. Do not show a confirmation dialog.
- One-time tasks and jobs complete immediately and show a short Undo action.
- Recurring tasks complete immediately without Undo because native completion
  advances the same live task.
- Do not show recurring completion as fully successful until Vikunja confirms
  the renewed live task and one completed non-recurring history snapshot.
- On failure or ambiguous renewal, keep or restore the visible task state and
  show a safe actionable error. Never repeat native renewal. Reconcile the
  snapshot's deterministic completion key before attempting archival repair.

## Confirmed skip and deletion behavior

- Skip applies only to an active, valid recurring task.
- Skip uses Vikunja's native recurring completion behavior, including its
  normal handling of overdue intervals. It never calculates or writes the next
  live schedule locally.
- The completed history snapshot receives both `vbu:recurrence-history` and
  `vbu:skipped`. The renewed live task does not receive `vbu:skipped`.
- No comment is created. The exact-title `vbu:skipped` label is the durable,
  filterable source of truth for the skipped outcome.
- Skip has no confirmation and no Undo.
- Delete applies only to an active task. A recurring-task deletion stops the
  live series while preserving its existing history snapshots.
- History entries and all other completed tasks are not deletable through this
  app. Both the UI and GraphQL mutation enforce that boundary.
- Skip and Delete appear only on the separate task page, beside `Extended`.
  Skip uses a non-destructive style. Delete uses the destructive red style and
  requires a routed confirmation page that names the task.
- Vikunja 2.5.0 does not provide a conditional task DELETE. The backend checks
  that the task is active immediately before deletion, but cannot make that
  check atomic against a simultaneous mutation made directly through another
  Vikunja client.

## Proposed recurring-task form

- Title.
- Optional description.
- Project.
- Priority.
- First due date, defaulting to today.
- Optional due time.
- Repeat interval: number plus day, week, or month.
- Renewal mode: From completion or Scheduled cycle.
- Default renewal mode: From completion.

## Confirmed one-time task form

- Title.
- Optional description.
- Project.
- Priority.
- Optional due date.
- Optional due time when a due date is set.

## Confirmed project behavior

- Every task is assigned to exactly one Vikunja project, matching Vikunja's data
  model. Do not simulate multi-project task ownership.
- Creation forms default to the Vikunja user's configured default project.
- If Vikunja has no default project, require explicit project selection.
- Let the user select another accessible project before creation.
- Treat "relate task to a project" as selecting or changing its owning Vikunja
  project. Task-to-task relations are outside the primary MVP flow.

## Confirmed app session behavior

- Use a signed, HTTP-only session cookie valid for 30 days.
- Refresh the expiry during authenticated use.
- Logout expires the cookie in the current browser.
- Do not add persistence or a server-side revocation list. Therefore, immediate
  cross-device revocation is not supported in the MVP.

## Extended task properties

- Keep primary creation and completion flows small.
- Provide an `Extended` action on task details.
- The action opens a separate read-only diagnostic page showing the underlying
  Vikunja-sourced properties that are present and relevant for that task.
- Include raw identifiers and recurrence/date values when useful for debugging.
- Values come directly from Vikunja. Do not provide editing or keep an
  application copy.
- Advanced properties must not appear in the default form unless required by
  the selected task type.

## Confirmed task classification

- Recurring: Vikunja recurrence fields are set.
- Job: the task has the Vikunja label `job` and no recurrence.
- One-time: no recurrence and no `job` label.
- A task must not be both recurring and a job. Treat that state as invalid and
  require correction instead of silently choosing a type.
- `vbu:` is the marker-label namespace reserved by the current Better Vikunja
  system. It is an application convention, not an official Vikunja namespace.
  The current reserved labels are `vbu:date-only`,
  `vbu:recurrence-history`, and `vbu:skipped`.

## Assumptions to validate

- [x] Vikunja remains the only task store.
- [x] Completing a recurring task must advance exactly one live schedule; on
      Vikunja 2.5.0 this is the same task ID.
- [x] Vikunja 2.5.0 native renewal reuses the task ID and overwrites `done_at`;
      retain history through completed non-recurring Vikunja snapshots.
- [x] One-time, recurring, and job are the complete MVP task categories.
- [x] A job can be represented with Vikunja's existing start, end, and due-date
      fields without a database.

## E2E and UX verification

- Use Playwright for browser E2E and responsive UX checks.
- Run Playwright with one worker in CI for deterministic access to the shared
  Vikunja test instance.
- Test critical UI flows in a real browser at phone, tablet, and desktop
  viewport sizes.
- Run integration E2E tests against a real Vikunja 2.4+ API v2 instance.
- Use a dedicated test project and test-owned tasks. Never mutate ordinary user
  projects or depend on their contents.
- Verify both visible UI output and resulting Vikunja state after task creation,
  completion, recurrence renewal, history loading, job date calculation,
  filtering, and pagination.
- Cover recurrence from completion and scheduled-cycle behavior. Assert one
  same-ID renewed live task and one completed snapshot without recurrence.
- Bound cleanup to resources created by the test run. Never delete or rewrite
  unrelated Vikunja data.
- Keep test credentials outside the repository and frontend bundle.

## Development test environment

- Install a pinned, signature-verified stable Vikunja 2.4+ binary in the Dev
  Container. Do not use Docker-in-Docker or mount the host Docker socket.
- Start one real Vikunja process for each complete `playwright test` invocation,
  not one process per individual test or viewport project.
- Give every invocation a new temporary directory and configure its SQLite
  database and files paths inside that directory.
- Stop Vikunja and remove only that run's temporary directory after Playwright
  finishes, including after failures.
- Use a test harness to allocate the port, start Vikunja, seed fixtures, expose
  the generated API token to the application process, start the application,
  run Playwright, and perform cleanup.
- Seed a test user, scoped API token, projects, and task fixtures through a
  documented test setup workflow. Never reuse production credentials.
- Use the same pinned Vikunja binary and test harness locally and in CI.

This provides a clean real Vikunja instance for every Playwright run without
changing Compose topology. It also avoids the privilege and lifecycle costs of
Docker-in-Docker or Docker-outside-of-Docker. Playwright supports managing
multiple web-server processes, but the project test harness owns dynamic ports,
fixture seeding, and cleanup because those steps form one lifecycle.

## CI and release

- Add a reusable GitHub Actions test workflow.
- Run it on every pull request and push to `main` as the required merge status
  check.
- Include generation drift, formatting/lint, Go vet, typecheck, unit tests,
  builds, integration tests, Playwright E2E, and production-image smoke checks
  as applicable.
- Start an isolated Vikunja 2.4+ process with a fresh SQLite directory for CI
  integration and Playwright E2E.
- Upload Playwright traces, screenshots, and reports when tests fail.
- Configure branch protection so the test workflow must pass before merge.
- Use Release Please with Conventional Commits to maintain the version,
  changelog, release PR, tag, and GitHub release.
- The release workflow must depend on the complete reusable test workflow. A
  failed or missing status check must prevent release creation and image
  publication.
- After Release Please creates a release, build and publish the production image
  with `revotale/docker-multi-arch-release-action@v1.4.0`.
- Publish `linux/amd64` and `linux/arm64` images to GHCR with the release tag and
  `latest`.
- Grant only the workflow permissions each job requires. Keep release tokens in
  GitHub Actions secrets.
- Pin third-party GitHub Actions to reviewed immutable commit SHAs where
  practical; record the corresponding stable version in comments.

## Research sources

- Dev Container Compose support:
  `https://code.visualstudio.com/docs/devcontainers/create-dev-container`
- Dev Container Compose guide:
  `https://containers.dev/guide/dockerfile`
- Vikunja binary installation: `https://vikunja.io/docs/installing/`
- Vikunja SQLite configuration:
  `https://vikunja.io/docs/config-options/`
- Playwright CI guidance: `https://playwright.dev/docs/ci`
- Playwright web-server lifecycle:
  `https://playwright.dev/docs/test-webserver`
- Release Please action:
  `https://github.com/googleapis/release-please-action`
- RevoTale release workflow reference:
  `RevoTale/lovely-eye/.github/workflows/release.yml`

## Not doing yet

- General Vikunja administration.
- Full parity with Vikunja's task editor.
- Projects, teams, permissions, comments, attachments, or dashboards unless a
  primary flow requires them.
- A local database.
- Calendar or timeline views.

## Implementation entry check

Pinned Vikunja 2.5.0 verification completed on 2026-08-12. Native renewal keeps
the same task ID and overwrites `done_at`; no occurrence-history API exists. The
accepted fallback is a completed, non-recurring snapshot stored in the same
Vikunja project and marked `vbu:recurrence-history`. Never create the next live
schedule manually.

## Confirmed route contract

- `/today?project=all`
- `/week?project=all`
- `/month?project=all`
- `/jobs?project=all`
- `/unscheduled?project=all`
- `/history?project=all&page=1`
- `/tasks/new?type=one-time|recurring|job`
- `/tasks/:id`
- `/tasks/:id/extended`
- `/tasks/:id/delete?returnTo=<validated-internal-url>`

Add semantic routes when new primary features are accepted. Query parameters
represent filters, pagination, and other reversible view state, not distinct
features.
