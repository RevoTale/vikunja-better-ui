# Vikunja Better UI

A focused Vikunja client for the workflows I actually use.

The main problem this solves is recurring tasks. Completing one should renew it
predictably without making me repeat Vikunja's full setup flow. The app also
keeps Today, Jobs, tasks without deadlines, and recent history close at hand.
It is deliberately not another general project-management system.

## AI-made only

This repository is made only through AI agents.

I define the product direction, constraints, and accepted decisions. AI agents
write the code, tests, and documentation. This is intentional and applies to
the whole repository.

## What it does

- Shows overdue and due-today tasks first, with week and project
  filters.
- Presents Week as a responsive day-row ledger with read-only scheduled-cycle
  projections and honest completion-based recurrence explanations.
- Keeps jobs in both Today and their own view.
- Groups tasks without deadlines by collapsible project.
- Creates one-time and recurring tasks, with an optional Job schedule for
  either type.
- Defaults recurring tasks to renew from completion, while also supporting a
  scheduled cycle.
- Completes recurring tasks in one click and keeps a Vikunja-backed history
  snapshot.
- Gives one-time tasks and one-time Jobs a short Undo window.
- Shows the latest 30 completed tasks initially, with URL-backed paging.
- Exposes a read-only Extended page for useful raw Vikunja fields.
- Works across phone, tablet, and desktop and follows the system light or dark
  color scheme with the configured TweakCN theme.

Vikunja 2.7.0 and its REST API v2 are the supported integration target.
The isolated E2E suite uses signed 2.7.0 binaries on Linux amd64 and arm64.
Older versions are not part of the current compatibility guarantee. Upgrade
Vikunja separately, following its [upgrade guidance](https://vikunja.io/docs/upgrade/)
and taking a backup first; updating Better UI does not upgrade your instance.
Better UI honors the instance's `service.maxitemsperpage` limit and reads
additional pages when needed, rather than requiring a particular server page size.

### Overdue schedule display

Active overdue task rows replace the scheduled date and time with **Overdue**,
followed by priority underneath. Priority is omitted from the metadata badges to avoid
duplication; unset priority appears as **No priority**. Overdue Job rows also
hide their work interval and **Complete by** deadline. Full dates remain on
the task detail page, where **Overdue** appears as a red outlined badge.
Overdue tasks sort by highest priority first, then earliest due date/time within
that priority, with title and ID as deterministic ties. Week keeps this order
inside each calendar day; future entries remain chronological. Stored dates are
unchanged.

Date-only deadlines become overdue after their stored end-of-day boundary;
their synthetic time stays hidden. Week rows use the same priority-first display,
while retaining their shared day heading. Completed history items, computed
occurrences and non-overdue schedules retain their dates and times.

## Recurring renewal behavior

Timed recurring tasks that renew **From completion date** default
**Keep due time** to enabled. The completion date controls the next calendar
date, while the task keeps its configured local deadline.

For a task due at 20:00 every two days:

| Renewal configuration | Completed | Next due |
| --- | --- | --- |
| From completion date; Keep due time on | Sunday 10:00 | Tuesday 20:00 |
| From completion date; Keep due time on | Sunday 21:00 | Tuesday 20:00 |
| From completion date; Keep due time off | Sunday 21:00 | Tuesday 21:00 |
| Scheduled cycle; current due Monday 20:00 | Tuesday 10:00 | Wednesday 20:00 |

Turning **Keep due time** off retains strict elapsed recurrence: two days means
exactly 48 hours. Scheduled cycle remains anchored to the existing schedule.
Complete and Skip use the same calculation. Date-only tasks do not show this
option.

See the [Keep due time specification](docs/specs/keep-due-time.md) for marker,
timezone, daylight-saving, validation, repair, and History behavior.

### Recurring Jobs

Enable **Job** on either creation form to add a start time, duration, and
completion window. A recurring Job keeps one live Vikunja task ID, uses the
same Completion and Skip behavior as every recurring task, and writes a
non-recurring Job snapshot to History for each occurrence.

History snapshots copy task fields, permitted labels and **Related** links only.
Comments and subtasks are never copied. Native renewal keeps the same live task
ID, so its existing discussion and subtask relationships remain on that live
series. A failed related-link copy uses the existing History repair flow; retrying
does not create another occurrence or duplicate confirmed links.

The next Job interval is always coherent:

```text
endAt = startAt + duration
dueAt = endAt + completion window
```

- **Scheduled cycle** advances from the previous `startAt`, skipping elapsed
  intervals when overdue.
- **From completion** normally starts after the exact elapsed interval.
- **Keep start time of day** instead advances the completion date by calendar
  days or weeks and restores the selected local start time, including across
  daylight-saving changes.

Live recurring Jobs display separate **Job** and **Recurring** badges. They do
not offer Undo. See the [Recurring Jobs specification](docs/specs/recurring-jobs.md)
and [ADR-006](docs/decisions/0006-recurring-jobs-use-native-renewal.md) for the
full creation, renewal, repair, projection, and History contracts.

### Task creation defaults

New task starts from normal defaults and the date/project selected on the
originating page. Nothing is filled automatically. Choose Job above the fields;
changing Job or recurring mode preserves shared values entered in this form.

Use the history icon beside title, project, priority, labels, or Job duration
and completion window to reuse that field from the latest task. Labels are
added without removing current selections. Dates, times, descriptions, and
recurrence rules are never copied. A click can replace the selected field;
loading a suggestion cannot. Unavailable values have disabled buttons.

Suggestions are fetched fresh through `taskReuseValues(job:, recurring:)`.
They come from the newest accessible task created by the configured Vikunja
API token owner (not the Better UI login), separately for all four Job/recurring
combinations. Sorting uses creation time, then ID, newest first. History copies
are excluded; ordinary completed tasks remain eligible. The existing user-read,
task-read, and label-read token permissions are sufficient. Lookup failures do
not block task creation; use **Retry previous values** to retry.

No task-creation values are saved in localStorage and there is no Reset autosave.
Old task-creation localStorage records are ignored; they are not read, updated,
or used to change a form. Discussion draft recovery is separate and unchanged.

### Today: tasks ready now

The Today navigation badge counts unfinished tasks across all accessible
projects whose deadline has passed **or** whose explicit **Start from** has
arrived. A task meeting both conditions counts once. Without Start from, a task
does not count until it is overdue—even when its deadline is today. Completed
tasks and computed future occurrences do not count.

This is an action signal, not a duration estimate or the total number of rows in
Today. The Today list and its project/label filters are unchanged.

The badge loads independently of the page. It refreshes after task mutations,
page navigation, returning to the browser tab, and every minute while visible.
External edits and time boundaries can therefore take up to one minute to appear
in a continuously visible tab. `cache-and-network` keeps the last known number
visible while updating; only the first uncached read shows a skeleton. The badge
marks revalidation as busy and its tooltip identifies the last known count.
`?` means unavailable, not zero. A confirmed zero is hidden with space reserved.

### Editing tasks and adjusting dates

Today is the default landing page, the logo's destination and the PWA start page.
Signing in preserves an explicitly requested page; otherwise it opens Today.

**Previous day**, **Next day**, and **Today** navigate by calendar date in the
Vikunja user's timezone. Today keeps its overdue queue. Other dates show only
that day's real tasks and read-only **Computed** scheduled cycles, assuming
earlier cycles are completed. Completion-relative recurrence is not predicted.
Project and label filters remain selected; **Add task** prefills the selected
date. No occurrences are created by browsing future dates.

Week starts at the top and never auto-scrolls on entry or refresh. Its **Today**
button explicitly returns to the current week and scrolls to today's heading.

**Long term** replaces **No date** and includes both **Later** (active tasks due
strictly after now plus seven calendar days) and **No deadline** tasks. The
cutoff uses the Vikunja timezone, including DST. Later tasks sort by due time;
undated tasks follow. These sections share pagination and project/label filters.
Existing `/unscheduled` links open Long term; GraphQL `UNSCHEDULED` retains its
original no-deadline behavior. The additive `LONG_TERM` scope provides both.

On an active task page, click the title or description to edit it in place.
Times default to 24h everywhere, including time inputs, task lists, comments,
schedule previews and public snapshot timestamps. `APP_TIME_FORMAT=12h` enables
AM/PM. Time inputs accept `HH:mm` or four digits (for example `2107`); in 12h
mode, select AM/PM beside the hour/minute field. Stored values remain canonical
24h times. Invalid or incomplete input cannot submit the previous valid time.

The description keeps the same rich-text styling without a large formatting
toolbar; existing formatting and keyboard shortcuts remain available. Links and
media controls stay interactive. Title Enter saves and Escape cancels; description
newlines never submit. **Save** confirms an edit; Cancel leaves the task unchanged.
Click Properties values to edit priority, project, labels, Job/recurrence and dates
in compact popovers. Empty labels and dates are editable too. Timezone is
informational and Overdue is calculated. Status uses normal completion/renewal and
Undo rules. Only one inline field can be edited at once. Unsupported description
formatting is preserved and requires editing in native Vikunja.

The full **Edit** page remains available for larger changes, schedule shifts and
duration adjustments. **Save changes** writes that form.
Recurring edits affect the live task and future projections, never completed
history. Completed tasks remain read-only.

**Shift schedule** previews a relative adjustment before applying it to the
form. Choose the whole schedule or just Start, End, or Due; choose Earlier or
Later; then enter any whole-minute duration, such as 56 minutes or 1 hour.
Creation forms shift the due date or the Job start (its end and due follow the
configured durations). Missing dates stay empty.

The preview is not saved automatically. **Apply shift to fields** updates the
visible date fields and clears the shift amount to prevent accidental repeated
shifts. **Save changes** saves those fields. Saving an unchanged task succeeds
after confirming its current state; changing only Job mode still updates its
marker label. A failed confirmation remains an error, not a successful save.

Duration and completion-window inputs accept **minutes, hours, or days**. Four
hours is stored as 240 minutes; changing units preserves the duration. In the
editor, **Set duration and completion window** recalculates End and Due from
Start. Timed durations use elapsed time: one day is 24 hours, including across
DST. Whole-day shifts of a date-only deadline use calendar days. Ambiguous or
nonexistent local times are rejected; the Vikunja user timezone is authoritative.
Shifts into a repeated DST hour are rejected in the preview before Apply is
enabled, since the form cannot distinguish the two occurrences of that hour.

The editor rejects a task changed since it was loaded and keeps your draft.
**Reload task and discard edits** explicitly replaces the draft with fresh
data. Vikunja stores task fields and marker labels through separate requests;
if a metadata update fails, the app reports partial success and asks you to
reload before retrying. It never reports that failure as a successful save.

Month is no longer a navigation tab. Existing `/month` links redirect to Week.
The GraphQL `MONTH` scope remains available for existing consumers.

### Task labels

In **New task** or **Edit**, use **Labels** to select existing Vikunja labels.
Enter a title and choose **Create or reuse label** to create one and select it.
Saving the task applies the selection; unchecking a label removes only its
association with that task, not the label itself. Completed history stays read-only.

**Today**, selected days and **Long term** have a single **Filter by label** control. It includes
tasks with that label and combines with the project filter. **All labels** clears
the filter. The label ID is stored in the URL and retained through pagination and
return navigation. Duplicate titles show their IDs; titles are not identifiers.

Internal `vbu:*` labels are hidden from these controls and protected on
the server. Only the exact `vbu:job` marker identifies a Job. **Breaking change:**
`job` is now an ordinary, visible, editable and filterable label, not a Job alias.
Existing tasks carrying only `job` no longer appear as Jobs, including in the
Glance integration. No existing labels or tasks are renamed or modified at startup.
Namespace protection ignores case and surrounding whitespace; Job classification
requires the exact canonical marker.

Labels are not remembered between task creations.
Creating a label is a separate action: it
remains in Vikunja if you abandon the form. Retrying reuses an exact existing title
(the lowest ID when duplicates exist); simultaneous creation from different
clients can still create duplicates.

Up to 50 selected IDs and label titles up to 250 characters are accepted. The
existing `labels` (`create`, `read_all`) and `tasks_labels` (`create`, `read_all`,
`delete`) token permissions are sufficient. Missing permissions are shown as
errors, not empty successful results.

If task creation succeeds but label attachment cannot be confirmed, **Task
created** offers **Review task labels**. Edit that task instead of creating it
again. An uncertain edit requires reloading before retrying. Existing GraphQL
clients may omit `labelIds` to preserve labels on edit; an empty list clears only
ordinary labels. `taskLabels` and `createTaskLabel` use the app session, with CSRF
protection for creation. `tasks(input: {labelId: ...})` accepts label filters only
for `TODAY`, `UNSCHEDULED` and `LONG_TERM`; creation payloads expose nullable `labelError`.

The Week view combines real tasks with clearly marked, non-actionable computed
scheduled cycles. It never assigns an estimated day to From completion
recurrence. See the [weekly ledger specification](docs/specs/weekly-ledger.md)
for navigation, projection, responsive-layout, and GraphQL behavior.

`day(input: {date, projectId, labelId})` reuses that server-side projection engine
for one local date, within ten years of today. It returns `day`, `isComplete`
and `issues`. Calendar reads are bounded by the existing candidate limit and
10,000 computed occurrences per response. Exceeding either limit reports an
incomplete result instead of silently truncating the schedule. The browser
never calculates recurrence or calls Vikunja directly.

List/calendar operations omit full task descriptions; details and editing still
load them. Independent session/project/list reads run concurrently. The backend
waits for timezone and selected-project authorization where necessary, coalesces
in-flight metadata reads, and loads remaining task pages with bounded concurrency.
There is no stale server result cache added by these views.

## Architecture and security boundaries

```text
React UI -> same-origin Go GraphQL API -> Vikunja REST API v2
```

The Go server embeds the static Vite build. Frontend source, metadata, and the
lockfile stay in Git; `internal/web/assets/dist` is an ignored build artifact
created before Go compilation by Task, CI, and the Docker frontend stage. The
browser talks only to the GraphQL endpoint and never receives or calls Vikunja
with its API token.

Authentication has two separate boundaries:

1. A person signs in to this app with `APP_AUTH_USERNAME` and
   `APP_AUTH_PASSWORD`.
2. The Go backend accesses Vikunja with `APP_VIKUNJA_API_TOKEN`.

A separate read-only integration endpoint accepts a caller-provided Vikunja
API token for server-to-server dashboards. It never exposes browser mutations
or replaces the app session boundary. See
[ADR-004](docs/decisions/0004-read-only-jobs-integration.md).

The app is stateless. It uses a signed, expiring, HTTP-only session cookie and
stores tasks, recurrence metadata, and history only in Vikunja. The exact
recurring-history design is documented in
[ADR-001](docs/decisions/0001-recurring-history-snapshots.md).

Task lists keep Apollo-cached rows visible only while performing a mandatory
fresh read. The backend overlaps independent Vikunja calls, coalesces duplicate
metadata reads only while they are in flight, and does not retain a TTL cache.
Background refreshes that finish within one second stay silent. A slower
refresh uses a fixed toast, so task rows do not move; it closes on success and
becomes an error toast on failure while cached rows remain visible. Initial
loading and initial errors stay in the page because no cached list exists.
Initial task and discussion loading uses content-shaped skeletons instead of
flashing loading text. The header reserves its timezone line. Comment counts
keep cached values during refresh, using inline placeholders only when unknown;
no extra per-task request is made. Count slots have identical skeleton/value
dimensions. Counts above 999 display `999+`, with exact values in accessible labels
and tooltips.
Each task-list skeleton includes three badge placeholders. Comment counts sit
at the left of the badge row; badges wrap on mobile without clipping titles or labels.
Discussions keep the editor and previous comments visible while a fresh page
loads, with an “Updating comments…” indicator. Failed reads clearly identify
retained comments as older results. Motion effects respect reduced-motion settings.
See [ADR-005](docs/decisions/0005-fresh-task-loading.md) and the
[performance guide](docs/performance.md) for the exact request graph,
benchmarks, and safe latency logs.

Static responses use URL-safe cache boundaries: content-hashed `/assets/*`
files are public and immutable for one year; the favicon and web manifest are
public for ten minutes; HTML routes are private and revalidated. GraphQL,
integration, health, and readiness responses are not stored. The application
does not add a persistent task cache or server-side task cache. Configure Brotli
or gzip at the production reverse proxy.

### Home-screen installation and offline launch

Install Better Vikunja from your browser (on iOS, Share → Add to Home Screen).
It opens on Today with platform-specific icons and safe-area-aware navigation.
A production service worker caches only the interface and static build files
for faster repeat loads. Offline launch shows a connection message and Retry;
tasks, sessions, attachments and mutations are never cached or queued.
Downloaded updates wait until existing app tabs close, preserving open editors.
See [PWA behavior and limitations](docs/pwa.md).

## Configuration

Copy `.env.example` to a local, ignored `.env` file and replace every example
secret.

| Variable | Required | Meaning |
| --- | --- | --- |
| `APP_VIKUNJA_URL` | Yes | Absolute Vikunja base URL. HTTPS is required in production. |
| `APP_VIKUNJA_PUBLIC_URL` | No | Public native Vikunja frontend URL, including its base path, for recognizing task references. Defaults to `APP_VIKUNJA_URL`; set it when the API uses an internal address. HTTPS is required in production. |
| `APP_VIKUNJA_API_TOKEN` | Yes | Vikunja token used only by the Go backend. |
| `APP_AUTH_USERNAME` | Yes | Username accepted by this app. |
| `APP_AUTH_PASSWORD` | Yes | Password accepted by this app. |
| `APP_SESSION_SECRET` | Yes | Base64 value decoding to at least 32 random bytes. |
| `APP_HTTP_ADDR` | No | Listen address; defaults to `:8080`. |
| `APP_LOG_LEVEL` | No | `debug`, `info`, `warn`, or `error`; defaults to `info`. |
| `APP_TIME_FORMAT` | No | `24h` (default) or `12h` (AM/PM). Controls displayed times and time inputs independently of browser/OS preference. Restart the service and reload the app/PWA after changing it; no frontend rebuild is needed. |
| `APP_PUBLIC_ACTIVITY_ENABLED` | No | `true` enables anonymous `/activity`; `false` (default) keeps public statistics disabled. |
| `APP_ENV` | No | `development`, `test`, or `production`; defaults to `production`. |
| `APP_ALLOWED_ORIGIN` | Production/test | Exact public app origin used for CSRF checks. Development defaults to `http://localhost:5173`. |

Use a dedicated Vikunja API token with these permissions:

| Permission group | Actions |
| --- | --- |
| `other` | `user` |
| `other` (optional author avatars) | `avatar` |
| `projects` | `read_all` |
| `tasks` | `create`, `read_all`, `read_one`, `update`, `delete` |
| `labels` | `create`, `read_all` |
| `tasks_labels` | `create`, `read_all`, `delete` |
| `tasks_comments` (Discussion) | `create`, `read_all`, `read_one`, `update`, `delete` |
| `tasks_attachments` (Discussion media) | `create`, `read_all`, `read_one` |
| `tasks_relations` (subtasks and related tasks) | `create`, `delete` |

This is the minimum permission set exercised by the app's end-to-end tests.
Missing permissions can make login or task operations fail because the backend
validates the token by reading the current Vikunja user immediately after app
authentication. Store the generated token value as `APP_VIKUNJA_API_TOKEN`.
Do not use the app username or password to authenticate with Vikunja.

### Mobile layout and creation drafts

Task rows use compact spacing with the same reserved geometry for loading
skeletons. Long titles and badges can still wrap; completion controls retain
their mobile touch targets. Today and Long term put project and label filters
side by side, with shorter controls on desktop.

Create/edit grids constrain long project names instead of widening the page.
Code and tables scroll inside their rich-text container. Background settings
refreshes, including failed refreshes, keep the ready creation form mounted:
already-entered title and description are not replaced by loading placeholders.
This does not add automatic field reuse or persistent task drafts.

### Public activity

Set `APP_PUBLIC_ACTIVITY_ENABLED=true`, restart the service, and open `/activity`.
No login is required. Leave it disabled if you do not want completion patterns
and the configured timezone to be public.

The page shows daily completion counts and a priority distribution with counts
and percentages for **today and the previous thirteen calendar days**, in the Vikunja
API token owner's timezone. It counts all completed tasks accessible to that
token, including completed Jobs and stored recurrence-history snapshots.
Skipped occurrences and renewed live tasks are excluded. Completion time
(`done_at`), not due date, determines the day. Tasks deleted from Vikunja cannot
be included; native recurrence without stored snapshots has no recoverable history.
The daily chart uses two seven-day rows, with weekday, date and count aligned
in each column.

Only aggregate counts, dates, timezone and snapshot timestamps are exposed.
Titles, descriptions, task IDs, users, labels and project names are not public.
There are no project, date-range or label filters. URL parameters do not change
the aggregation. Existing `other:user` and `tasks:read_all` token permissions
are sufficient; the browser never receives the token.

One server-side aggregate is cached for ten minutes per process. Reload the page
after expiry to request a newer snapshot; the displayed timestamp identifies
the data's age. The first request makes one user lookup and one request per
100 completed tasks, without fetching individual tasks, comments or attachments.
Cache hits make no Vikunja requests, and simultaneous misses share one refresh.
Tasks are reduced one page at a time, not retained in a cache or database.

Refreshes have a 20-second deadline, a 1,000-page safety limit and the client's
bounded response-size checks. Failed refreshes return a safe error, not partial
counts, and have a 30-second retry cooldown. The GraphQL response remains
`private, no-store`; the ten-minute cache is the aggregate inside the service,
not a browser or CDN copy of authenticated responses. Use normal reverse-proxy
rate limits for public traffic; fixed queries do not eliminate network-level DoS.

### Subtasks and related tasks

Open a task, then use **New subtask** to create a child or **Link subtask** to
attach an existing task. **Link task** in Related tasks adds a symmetric native
Vikunja relation. Search by title or ID; results are paginated. Open a child to
navigate back to its parent. Unlinking asks for confirmation and deletes neither
task.

New children copy only project, priority and ordinary labels, once. Expand
**Properties** to change those values before creating. Dates, Job, recurrence,
description and internal `vbu:*` labels are not copied. Creation leaves the form
open for another child. Escape closes it. If linking fails after creation,
**Retry linking created task** reuses the created ID without creating another task.
An unconfirmed creation keeps the draft and blocks resubmission: check the task
list, then explicitly confirm no task was created to unlock that same draft.
Validation or access rejections leave the draft editable.

Better UI rejects self-links, cycles and adding another parent. Multiple parents
created elsewhere are displayed for explicit cleanup. Checks cannot lock out
concurrent edits from another Vikunja client. Completing or deleting a parent
does not complete or delete its children. Relations belong to the live task,
not completion-history snapshots. History snapshots cannot be linked here.

Relations load independently, with one upstream task read for the section.
Each response is limited to 1,000 supported related-task summaries; hierarchy
checks stop after 1,000 distinct ancestors or ten seconds. Larger graphs report
an error rather than silently returning a partial successful result.

Saving a description or comment through Better UI adds **Related tasks** for new
task references. Both HTML links and visible plain URLs are recognized. Better UI
trusts `APP_ALLOWED_ORIGIN` and `APP_VIKUNJA_PUBLIC_URL` (or `APP_VIKUNJA_URL`),
including the configured native base path. Supported paths are `/tasks/{id}`,
Better UI's `/discussion` and `/edit` suffixes, and relative `/tasks/{id}` links.
Queries and fragments do not change the target. External origins, self-links,
code, generated reply quotations and hidden metadata are ignored. Ordinary
blockquotes are content, not generated replies. No pasted URL is fetched.

Edits consider only newly introduced targets. Removing text never unlinks tasks,
and unrelated text edits do not recreate a manually removed link. Native-client
edits and old content are not scanned in the background. The workflow processes
at most 20 unique targets and 512 KiB of content, with a five-second linking budget.
Oversized or incomplete previous content is not rescanned; a warning requests
manual review. Same-task writes run sequentially; target/access reads use the
existing bounded relation workflow.

Content remains saved if linking fails. A persistent **Saved; some task links need
attention** notice offers **Retry links** for failed targets only. Repair rereads
the persisted description/comment and checks access; it never reposts the comment
or recreates the task. Reloading/dismissing the notice does not store a repair
queue; links can still be added manually. Existing `tasks_relations:create`
permission is sufficient for automatic linking.

### Task discussion

Open a task to read its formatted description, inspect its properties and join
the discussion below. On wide screens, properties sit beside the description;
on phones, they appear between the description and discussion. **Edit** keeps
the existing task editing workflow. Creation and editing use the shared rich-text
editor for descriptions, including emoji, code, tables and formatting. An untouched
description is submitted exactly as loaded, not reserialized on focus. Unsupported
native formatting is read-only here so other field edits cannot discard it; edit
that description in Vikunja. Media uploads remain in Discussion after creation.

The creation mutations accept `descriptionFormat: HTML` for rich descriptions.
Omitting it keeps the existing `MARKDOWN` conversion behavior for API callers.
Task updates continue to use Vikunja's stored HTML representation.

Choose **Discussion** for the separate conversation page. Both views share the
same **Sort comments** selector: **Oldest first** reads the conversation in
chronological order; **Newest first** shows recent comments first. Changing
order returns to the first page without clearing the draft. **Refresh** shows
a spinner only if the request is still pending after one second. Before that,
the button keeps its normal appearance while blocking duplicate clicks. A fast
response goes directly to a checkmark with **Updated**, shown for two seconds.
A failed refresh shows an error, never a success confirmation.

Comments use separate, subtly bordered cards with a contrasting surface and a
divided action row, in both light and dark themes. Loading placeholders follow
the same card outline; keyboard focus adds a ring without resizing the comment.

Use **Insert emoji** to search Unicode emoji, including skin tones and joined
sequences. Typing a shortcode such as `:thumbsup` offers suggestions: choose one
with arrow keys and Enter, or click it. Escape dismisses suggestions without
changing the text. Code and URLs stay literal. Emoji are normal text in saved
HTML, not reactions or externally hosted images. The English Emojibase dataset
is a separate on-demand editor chunk; the PWA may pre-cache it in the background.
No third-party CDN is contacted.

Discussion links are underlined and colored in both themes. Pasted HTTP(S) and
`www.` URLs become links immediately; typed URLs convert after Space or Enter.
Localhost, IP addresses and ports are supported. Incomplete URLs and code stay
literal. Paste a URL over selected text to keep that text as its label. Click an
editor link or use **Link** / **Cmd/Ctrl+K** to open, edit or remove it.

Same-origin Better UI task links resolve through GraphQL during editing and save
the task title as a snapshot. Other origins, including native Vikunja URLs, stay
ordinary links. Lookup failures never block publishing. Delayed results cannot
overwrite edited or removed links, or change a submitted draft. Saved titles do
not follow later task renames; the destination still identifies the same task.
Published comments perform no title lookups. Legacy plain URLs become clickable
for display only, without changing stored HTML. Links open in a new tab with
opener protection; custom labels are preserved.

Comment cards use compact spacing and a single 44px Reply action row without
extra vertical footer padding. Loading placeholders match the card padding.

The **Comment actions** (`…`) menu contains **Copy link to comment** and **Copy
content as Markdown**. Authors also have **Edit** and **Delete**, with deletion
confirmation. **Reply** remains directly visible. Copy success shows a temporary
checkmark; clipboard failures show an error. Direct links retain their target
through login and open an original-comment dialog if the comment is outside the
loaded page. Deleted or inaccessible targets show the existing unavailable state.

Markdown copying preserves standard text formatting and code. Rich structures
without a faithful Markdown representation retain sanitized HTML, including
tables and media. Attachment links still require app access; copying does not
make attachments public. Unsupported native content cannot be copied as Markdown
or edited here; use native Vikunja instead. Thread subscriptions, resolution and
task/subtask creation from comments are not part of this menu.

Both views share comments, reply navigation and browser-local draft recovery. A discussion
loading error does not hide task details. Write formatted comments, add links,
reply with a quote, or edit and delete your own comments. Deletion asks for
confirmation. The token needs the `tasks_comments` permissions listed above.

The editor supports headings, lists, checklists, quotes, tables, separators,
safe links, inline code and code blocks. **More formatting** includes underline,
strikethrough, highlight, subscript and superscript. Code blocks have language
selection, syntax highlighting and **Copy code**. Successful copying shows a
green checkmark and **Copied** for two seconds without changing button width.
If clipboard access fails, a visible message suggests selecting and copying
the code manually; no success checkmark is shown. Pasting into code preserves
literal text and whitespace. Select a table cell to add/remove rows or columns.
Formatting buttons have icons and show when active. Click **Underline**, **Bold**
or **Inline code**, then type; click again to turn it off. Selected text is
formatted in place. **Code block** is separate from inline code. Heading, quote
and list buttons also toggle back to a paragraph. **Undo** and **Redo** are
disabled when there is no corresponding editor history. Link editing preserves
the selected text while you enter a URL.
Markdown shortcuts include `# ` for headings, `- ` for bullets, `[ ] ` for
checklists and a fenced-code prefix. Type three backticks on an empty line of
a normal paragraph: the third backtick immediately opens a code block. No Space
or Enter is needed. Choose the language with **Code language** afterward.
This also works after Shift+Enter, retaining the preceding text. Undo restores
the literal fence; Redo restores the block. Pasted text stays literal, including
backticks. A pasted fence (optionally followed by `js` or another language)
can still be converted explicitly with Enter or Space. Use **Continue writing**
to leave the code block.

Editor and saved comments share Tailwind typography: readable body text,
proportional headings and inline code, and block-level monospace code with
horizontal scrolling. Lists, tables and code padding scale with their text.

Replies are ordinary Vikunja comments with a source quote and original ID.
Task lists show a small discussion icon at the left of the metadata row,
with flexible space before the right-aligned, wrapping badges.
It shows the total number of comments,
including replies. Click it to open Discussion. Zero/unknown counts and computed
occurrences do not show the indicator. Counts arrive with the task-list request
through Vikunja's `expand=comment_count`, without per-task comment requests.
Main comment headers and quoted replies show the author's name and Vikunja avatar, with
initials while loading or if the photo is unavailable. Enable `other:avatar`
on the backend token for photos; missing access does not block comments.
Avatars are cached in memory for the current app session, not stored locally.
Click the small arrow beside the author (**View original**) to jump to its
original. Off-page originals load in a dialog. Follow quote arrows through a
chain; **Back to reply** retraces your steps. Closing the dialog returns to
your starting comment. Your draft stays unchanged. If an original is unavailable,
the quote remains readable and you can retry or go back.
Native comments with unsupported structures or styles remain read-only here;
edit them in Vikunja to avoid losing content. Native Vikunja 2.5 displays
highlight/subscript/superscript as plain text and removes these formats on save.
The composer warns when these formats
or media players are used; keep editing them in Better UI.

#### Images, audio and video

Open **Media and attachments** to upload a file or choose an existing task
attachment. You can also paste or drop a file. The file picker works on mobile.
Add alternative text to images. Audio/video use native controls, without
autoplay; codec support depends on the browser.

- One file per upload, at most **20 MiB**; Vikunja may impose a smaller limit.
- Images: PNG, JPEG, GIF, WebP. No SVG, HEIC, arbitrary remote images or embeds.
- Audio: MP3, WAV, Ogg, FLAC, M4A/MP4 and WebM. Video: MP4, WebM and Ogg.
  Content signatures are checked; this is not a full codec validator or transcoder.
  Free-format MP3 is not detected. Native audio-only WebM may be classified as
  video when reused unless its filename ends in `.weba`.
  FLAC with only a final STREAMINFO metadata block is rejected because Vikunja
  2.5 cannot persist a playable MIME type for it.
- Uploads become **Vikunja task attachments immediately**, before posting.
  Removing a reference, undoing insertion, deleting a comment or abandoning a
  draft does not delete the file. Manage unused files in native Vikunja.
- You can keep typing during upload. Posting waits for it; completion updates
  only that upload's placeholder. An uncertain upload is not retried: check
  **Choose task attachment** and reuse the file, or explicitly allow another upload.
- Native Vikunja displays audio/video as attachment links. Editing there can
  remove the player marker; the link and underlying file remain.

For native image interoperability, `APP_VIKUNJA_URL` must match the API base
used by the native client, including any path prefix. Stored image references
use native API v1 URLs; Better UI's backend transport uses API v2. Better UI
displays files only through authenticated same-origin media URLs; the browser
never receives the Vikunja token. Responses use `Cache-Control: private, no-store`.
Seeking works only when Vikunja supports the requested byte range.
Attachment deletion permission is not needed.

Drafts stay in this browser, separately for each Vikunja user, task and edited
comment. **Restore draft** is explicit and disabled once you start editing.
**Discard saved draft** asks for confirmation and removes only that local draft;
posted comments and uploaded files remain. Once you type, **Dismiss draft notice**
only hides the recovery notice and keeps your current text and autosaved draft.
Unavailable storage never blocks typing or posting. A failed save keeps the
text and disables another submission until you check the refreshed discussion
and choose **I checked; allow retry**. There is no automatic write retry.

Comments load oldest first, 50 per page (or the instance limit). **Newest first**
changes upstream ordering; **Refresh** reloads without replacing your draft.
Vikunja orders by creation time; comments with identical timestamps have no
guaranteed tie order. Pagination is not a snapshot if other clients add/delete
comments while you browse.

#### GraphQL API

The authenticated GraphQL API exposes `taskComments(taskId, page, pageSize,
order)`, `taskComment(taskId, commentId)` and `createTaskComment`,
`updateTaskComment`, `deleteTaskComment`.
Mutation inputs require the existing CSRF token. Comment authors are the
Vikunja token owner; the app login name does not change authorship.

Media adds `taskAttachments(taskId, page)` and `uploadTaskMedia(input)` with an
`Upload` scalar. Send uploads as GraphQL multipart requests with the existing
session, exact Origin and `X-CSRF-Token` header. Metadata and upload remain
GraphQL; only binary GET/HEAD uses `/media/tasks/{task}/attachments/{attachment}`.

Comments remain in Vikunja as HTML. Ordering (`ASC` by default, or `DESC`)
and pagination run in Vikunja, with one page fetched per query. The returned
page size reflects the instance's cap. Editing and deleting remain subject
to Vikunja's author and task permission checks.

HTML is sanitized before display, import and export; only supported content and
safe links are rendered. Existing installations can keep using task views
without comment permissions; only Discussion needs the additional capabilities.
See the [discussion specification](docs/specs/task-discussion.md) and
[API contract](docs/specs/task-discussion-api.md).

## Read-only Jobs integration

`GET /integrations/v1/jobs` exposes the existing Jobs classification and
pagination behavior as JSON for Glance and similar server-to-server
dashboards. It accepts a dedicated Vikunja API token from the caller and uses
it only against the configured `APP_VIKUNJA_URL`. Requests return active Jobs
by default:

```http
GET /integrations/v1/jobs?label=dashboard&page=1&pageSize=30
Authorization: Bearer <Vikunja API token>
```

To request Jobs completed during a caller-defined interval, use a half-open
RFC 3339 range:

```http
GET /integrations/v1/jobs?status=completed&completedFrom=2026-08-24T00%3A00%3A00%2B03%3A00&completedBefore=2026-08-31T00%3A00%3A00%2B03%3A00&label=dashboard&pageSize=100
Authorization: Bearer <Vikunja API token>
```

`completedFrom` is inclusive and `completedBefore` is exclusive. Both are
required with `status=completed`. The caller supplies absolute timestamps, so
it owns week-start, timezone, and daylight-saving calculations. Completed Jobs
are ordered by `doneAt` newest first, then by task ID newest first. Supplying a
completion boundary for active status is invalid.

To build one chronological roster without merging JSON arrays in Glance, use
`status=all`. The completion range limits only the completed part; all active
Jobs remain eligible:

```http
GET /integrations/v1/jobs?status=all&completedFrom=2026-08-24T00%3A00%3A00%2B03%3A00&completedBefore=2026-08-31T00%3A00%3A00%2B03%3A00&sortBy=startAt&sortOrder=asc&label=dashboard&pageSize=100
Authorization: Bearer <Vikunja API token>
```

Both completion boundaries are required. `sortBy` accepts `startAt` and
`finishAt`; `sortOrder` accepts `asc` and `desc`. They default to `startAt` and
`asc` and are valid only with `status=all`. A Job's `finishAt` is its actual
`doneAt` after completion and its planned `dueAt` while active. Missing sort
timestamps always appear last, and task ID provides a stable tie-breaker. The
server loads active and completed Jobs concurrently, merges and sorts the full
bounded candidate set, and only then applies pagination.

The optional `label` parameter is an exact, case-sensitive label-title match.
When present, returned tasks must have both the `vbu:job` marker and the requested
label. An unknown label returns an empty page. `page` defaults to `1`, and
`pageSize` defaults to `30` with a maximum of `100`.

The caller token needs only these Vikunja permissions:

| Permission group | Actions |
| --- | --- |
| `other` | `user` |
| `projects` | `read_all` |
| `tasks` | `read_all` |
| `labels` | `read_all` |

Create a separate token for the dashboard. Pass it in the `Authorization`
header over HTTPS; never place it in a URL or commit it to configuration. The
endpoint does not store, return, log, or use the token for mutations. It also
does not use `APP_VIKUNJA_API_TOKEN`, so results reflect the projects and tasks
visible to the caller token.

Successful responses contain `items`, `page`, `pageSize`, `totalItems`,
`totalPages`, `hasMore`, `isComplete`, and `issues`. Each item contains its ID,
title, description, project, normalized priority, due/start/end timestamps,
`doneAt`, `finishAt`, labels, timezone, overdue state, and absolute Better UI
task URL. Timestamps are RFC 3339 values or `null`; `doneAt` is always `null`
for active Jobs. `finishAt` preserves `dueAt` as the active plan and switches
to `doneAt` as the completed fact. Priorities are `UNSET`, `LOW`, `MEDIUM`,
`HIGH`, `URGENT`, or `DO_NOW`.

### Glance custom API widget

Provide `VBU_URL` and `VIKUNJA_JOBS_TOKEN` to the Glance container through its
environment, then configure a custom API widget:

```yaml
- type: custom-api
  title: Jobs
  title-url: ${VBU_URL}/jobs
  cache: 5m
  url: ${VBU_URL}/integrations/v1/jobs
  headers:
    Authorization: Bearer ${VIKUNJA_JOBS_TOKEN}
    Accept: application/json
  parameters:
    label: dashboard
    pageSize: 100
  template: |
    <ul class="list list-gap-10">
      {{ range .JSON.Array "items" }}
        <li>
          <a href="{{ .String "url" }}">{{ .String "title" }}</a>
          <div class="size-h6 color-paragraph">{{ .String "project.title" }}</div>
        </li>
      {{ else }}
        <li>No matching jobs.</li>
      {{ end }}
    </ul>
```

Glance performs this request from its server, not from the dashboard browser.
Invalid or missing tokens return `401`; insufficient token permissions return
`403`; invalid parameters return `400`; oversized result sets return `422`;
and unavailable or invalid Vikunja responses return `502`.

For a completed-this-week widget, calculate absolute week boundaries in the
same timezone used by the dashboard and provide them to Glance, for example as
`VIKUNJA_JOBS_COMPLETED_FROM` and `VIKUNJA_JOBS_COMPLETED_BEFORE`:

```yaml
- type: custom-api
  title: Jobs completed this week
  cache: 5m
  url: ${VBU_URL}/integrations/v1/jobs
  headers:
    Authorization: Bearer ${VIKUNJA_JOBS_TOKEN}
    Accept: application/json
  parameters:
    status: completed
    completedFrom: ${VIKUNJA_JOBS_COMPLETED_FROM}
    completedBefore: ${VIKUNJA_JOBS_COMPLETED_BEFORE}
    label: dashboard
    pageSize: 100
  template: |
    <ul class="list list-gap-10">
      {{ range .JSON.Array "items" }}
        <li>
          <a href="{{ .String "url" }}">{{ .String "title" }}</a>
          <div class="size-h6 color-paragraph"
            {{ .String "doneAt" | parseTime "rfc3339" | toRelativeTime }}></div>
        </li>
      {{ else }}
        <li>No Jobs completed in this interval.</li>
      {{ end }}
    </ul>
```

Generate or refresh those values at the local week boundary. Better UI does
not infer a timezone from the dashboard request.

Use the same boundary variables with `status: all`, `sortBy: startAt`, and
`sortOrder: asc` when one Glance template should render active and completed
Jobs together. Change `sortBy` to `finishAt` when the roster should follow
planned or actual finish rather than scheduled start.

## Development

Open the repository in its Dev Container first. The container installs pinned
Go, Node.js, pnpm, Task, Playwright, and Docker access. Rebuild the Dev Container
after changing files under `.devcontainer/`.

Run all project commands inside that container:

```sh
task gen        # regenerate gqlgen, GraphQL operations, routes, and build web assets
task gen:check  # prove committed generated source is current
task fix        # format Go and frontend files
task validate   # quality-gate tests, formatting/modernization, lint, types, vet, build
task test       # Go race tests twice with shuffled order, plus frontend unit tests
task e2e        # real browser tests against isolated Vikunja 2.7.0
task demo       # run the complete isolated demo at http://localhost:4180
task dev        # run the application
```

The [quality contract](docs/quality-gates.md) defines file/function limits,
complexity, Go documentation and architecture checks, generated-code exclusions,
and how to reproduce shuffled failures. `task fix` applies Go formatting/imports
and Biome fixes; apply Go modernization separately with `go fix ./...` and review
the diff. CI uses the same `gen:check`, `validate`, `test`, and `e2e` entrypoints.

### Automated dependency updates

Renovate extends the RevoTale organization preset, which follows the official
`config:best-practices` preset. In particular, npm releases must be at least
three days old before Renovate creates a branch; pnpm independently rejects
packages newer than one day during every frozen install. The Dependency
Dashboard shows updates waiting for either policy. This repository uses only
Renovate's built-in Dockerfile, Dev Container, npm, and Go module managers.

Renovate groups runtime updates so Go, Node.js, and pnpm pins change together.
Go module updates run `go mod tidy`, npm updates deduplicate the pnpm lockfile,
and major upgrades stay in separate PRs labeled `breaking`. Renovate-hosted
does not run arbitrary repository generation commands, so CI still requires
committed GraphQL and route output to remain unchanged. The Vite production
bundle is built during CI and is deliberately not committed; dependency
updates that only change chunk contents or hashes therefore do not create
generated-source drift. A tool upgrade that changes committed generated source
still needs a reviewed follow-up commit rather than bypassing `task gen:check`.

The production and development images copy pnpm from the official,
digest-pinned pnpm image. The frontend build runs on the separately pinned
Node.js image, while CI reads the exact Node.js version from
`frontend/package.json`. Task and golangci-lint are isolated as standard Go
tool dependencies in `tools/go.mod`; CI and the Dev Container install those
exact versions with `go install tool`. Gqlgen remains a tool of the application
module. No global npm, Corepack, custom Renovate manager, or version-check
script is required.

### Frontend components

The frontend uses the current shadcn Base UI registry. Files under
`frontend/src/components/ui` are generated vendor code: add or refresh a used
component only from `frontend/` with
`pnpm dlx shadcn@latest add <component>`. Do not edit those files directly;
apply product defaults through props, semantic theme tokens, or wrappers in
`frontend/src/components` and feature code.

The date picker currently composes `@daypicker/react` v10 in feature code with
generated Dialog, Popover, and Button components. This narrow exception avoids
an upstream shadcn Calendar strict-TypeScript incompatibility and should be
removed once the registry output compiles unchanged. See the
[Base UI migration specification](docs/specs/shadcn-base-ui.md).

Base UI is mounted with its CSP provider. The server generates a unique nonce
for every response and passes it through the HTML to Base UI's inline style
elements. Runtime style attributes used for popup positioning are allowed
separately; `style-src` includes that allowance as a WebKit fallback, while
`style-src-elem` remains nonce-restricted and `script-src` stays self-only.

`task e2e` downloads the official Vikunja 2.7.0 binary for Linux amd64 or
arm64, verifies its pinned SHA-256 digest and detached signature, and runs it
directly with an isolated SQLite directory. Every run creates deterministic
fixtures and a short-lived scoped token, then removes its temporary data.

Playwright uses its bundled browsers by default. To verify an upstream Chromium
runtime fix, set `E2E_CHROMIUM_EXECUTABLE` to an already-installed browser's
absolute path inside the Dev Container before running `task e2e`. This changes
only Chromium projects; WebKit and all test assertions remain unchanged. The
harness does not download an alternative browser or silently fall back to one.
Custom browser versions are not guaranteed compatible with Playwright; record
the exact version and full-suite results. See the
[Discussion verification record](docs/specs/task-discussion-verification.md)
for the ARM64 video-renderer issue and tested runtime.

### Preview the complete E2E app

Run this inside the Dev Container:

```sh
task demo
```

Open <http://localhost:4180> and sign in with:

```text
Username: app-user
Password: app-password-strong
```

The command builds the frontend and Go server, starts an isolated Vikunja 2.7.0
instance, creates deterministic fixtures and a scoped API token, and serves the
complete app. Stop it with `Ctrl-C`; its temporary database and files are then
removed.

The Dev Container forwards port `4180`. If VS Code assigns a different local
port, restart the demo with that forwarded address. For example, when VS Code
uses local port `4181`, run:

```sh
task demo DEMO_ORIGIN=http://localhost:4181
```

`DEMO_PORT` controls the container listener; `DEMO_ORIGIN` controls the browser
origin accepted by the server. To use port `4190` on both sides, run
`task demo DEMO_PORT=4190` and forward local port `4190`.

Running only the frontend development server is not a complete preview: GraphQL
requests to `/graphql` return 404 because the Go API is not present.

## Container image

Build and smoke-test the same non-root image used for releases:

```sh
task image:smoke
```

To run a built image, pass the variables above and publish port 8080:

```sh
docker run --rm -p 8080:8080 --env-file .env ghcr.io/revotale/vikunja-better-ui:latest
```

The runtime image contains CA certificates and timezone data and runs as a
non-root user.

The Go process uses about 10 MiB RSS while idle in the development fixture, but
peak memory depends on Vikunja task payloads and concurrent requests. In a
memory-limited container, set Go's `GOMEMLIMIT` 5–10% below the container limit;
for example, use `GOMEMLIMIT=115MiB` with a 128 MiB limit. Go 1.26 handles
cgroup CPU limits automatically. See [the performance budget](docs/performance.md)
for reproducible benchmarks, measured allocations, and tuning constraints.

## CI and releases

Pull requests and `main` run one reusable required-checks job covering generated
drift, validation, unit/integration tests, real Playwright E2E, and the
production image smoke test. Configure the GitHub branch rule for `main` to
require the `Required checks` status before merge.

CI starts automatically on pull-request updates. A newer run cancels the older
run for the same PR; different PRs run independently. Checks on `main` run
through the Release workflow and are not cancelled by PR updates. No custom
approval gate or manual dispatch is configured.

After checks pass on `main`, release-please creates or updates the release pull
request. Merging that pull request creates the release, and the pinned RevoTale
action publishes `linux/amd64` and `linux/arm64` images to GHCR with the release
tag and `latest`.

See [AGENTS.md](AGENTS.md) for the repository rules and
[the MVP specification](docs/specs/mvp.md) for the complete product contract.
