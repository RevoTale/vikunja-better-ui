# Task Discussion API

## Module objective

Expose a stable GraphQL facade over Vikunja task comments while preserving the
existing authentication, CSRF, permission and upstream-error conventions.

## Verified upstream contract

Verified on 2026-09-26 against the official
[API v2 OpenAPI](https://try.vikunja.io/api/v2/openapi.json).
All paths below are relative to `/api/v2`:

- `GET /tasks/{taskID}/comments?page=1&per_page=50&order_by=asc|desc`
  returns `items`, `page`, `per_page`, `total`, and `total_pages`.
- `POST /tasks/{taskID}/comments` creates a comment.
- `GET /tasks/{taskID}/comments/{commentID}` reads the quoted original or confirms
  an update, enforcing the task/comment association upstream.
- `PUT /tasks/{taskID}/comments/{commentID}` replaces the comment body.
- `DELETE /tasks/{taskID}/comments/{commentID}` deletes a comment.

The server forwards pagination and ordering; it does not fetch all comments or
sort a partial page locally. Respect the instance's returned `per_page`, which
may be smaller than the requested size. The older draft confused v1 with v2;
the v1 methods and bare-array response must not be used here.
The upstream comment payload identifies the task through the request path, so
the adapter assigns the validated path task ID to each returned item rather
than trusting a body field that may be absent.

Vikunja 2.5.0 PUT responses omit the author and creation timestamp. A confirmed
update therefore performs one PUT and one GET. A failed confirmation returns
`UPDATE_UNCONFIRMED`, even if the GET returns 403/404; the write may already have
succeeded and must not be replayed automatically. List/create/delete normally
cost one upstream request each. Opening an unloaded original costs one GET.

Consistent empty pages beyond `totalPages` are valid after deletions. The UI
moves back to the last remaining page. Ordering is by upstream creation time;
equal timestamps have no guaranteed tie-breaker.

## GraphQL contract

The contract models comments explicitly:

```graphql
type TaskComment {
  id: ID!
  bodyHtml: String!
  author: DiscussionAuthor!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type TaskCommentPage {
  items: [TaskComment!]!
  page: Int!
  pageSize: Int!
  totalPages: Int!
  hasMore: Boolean!
}

enum DiscussionOrder { ASC DESC }

taskComments(taskId: ID!, page: Int! = 1, pageSize: Int! = 50,
  order: DiscussionOrder! = ASC): TaskCommentPage!
taskComment(taskId: ID!, commentId: ID!): TaskComment!
```

Mutations are explicit actions:

```graphql
createTaskComment(input: CreateTaskCommentInput!): TaskComment!
updateTaskComment(input: UpdateTaskCommentInput!): TaskComment!
deleteTaskComment(input: DeleteTaskCommentInput!): DeleteTaskCommentPayload!
```

Every state-changing input contains `csrfToken`. The GraphQL layer must not
accept an author, timestamp or permission field from the browser.
Create/update inputs contain `taskId` and `bodyHtml`; update/delete also require
`commentId`. `bodyHtml` is limited to 100,000 UTF-8 bytes; page size is 1–100.
IDs must be positive. The token needs `tasks_comments` permissions
`read_all`, `read_one`, `create`, `update`, `delete`.

## Mapping rules

- `bodyHtml` maps to Vikunja's comment body.
- `author`, `createdAt` and `updatedAt` are mapped from the upstream response.
- A quoted comment ID is derived only for display by parsing the first allowed
  `blockquote[data-comment-id]`; it is never used for authorization.
- Vikunja 403/404/validation failures become stable, user-safe GraphQL errors.
- Missing author data or inconsistent pagination is reported as an upstream
  mapping error. HTML sanitization belongs at the editor/render boundary.

## Verification

- Mock each Vikunja comment operation and assert the exact request path,
  method, token forwarding and response mapping.
- Assert CSRF rejection before any upstream request.
- Assert that a forged author or quoted ID cannot change authorization.
- Assert partial/malformed upstream responses produce structured errors.
- Assert pagination and ordering are forwarded without loading all comments.

## Attachments and media

Verified against the pinned Vikunja 2.5.0 fixture and its own `/api/v2/openapi.json`:

- `GET /tasks/{task}/attachments?page=1&per_page=50` returns paginated metadata.
- `POST /tasks/{task}/attachments` accepts multipart `files`. HTTP 201 can
  contain both `success` and `errors`; only one confirmed attachment is success.
- `GET /tasks/{task}/attachments/{attachment}` returns bytes and accepts a
  forwarded single byte range when supported by the instance.

GraphQL adds `taskAttachments(taskId, page)` and `uploadTaskMedia(input)`.
The input contains `taskId`, `csrfToken` and one `Upload` file. Metadata includes
ID, task ID, filename, MIME, byte size, same-origin `contentUrl` and native
`sourceUrl` for HTML persistence. Do not fetch `sourceUrl` from browser code.
Attachment capability actions are `tasks_attachments:create,read_all,read_one`;
no delete operation or permission is used.

Upload limits: 20 MiB per file; 21 MiB for the multipart envelope; ordinary
GraphQL JSON requests are limited to 1 MiB. Multipart requires a positive known
Content-Length. Session, exact Origin and CSRF header are checked before parsing.
gqlgen spills file bodies over 1 MiB to temporary disk and cleans them after
the request; this is not application persistence. File signatures and names
are validated before forwarding. Partial/ambiguous writes return
`UPLOAD_UNCONFIRMED` and must not be automatically retried.

The narrow binary exception is authenticated same-origin GET/HEAD
`/media/tasks/{task}/attachments/{attachment}`. Positive IDs select a fixed
Vikunja path; query strings, arbitrary URLs, redirects and multiple ranges are
rejected. Upstream permissions remain authoritative. Only safe image/audio/video
responses are streamed, with bounded buffers, private no-store caching, nosniff
and same-origin resource policy. Upstream cookies and redirects are not forwarded.
HEAD closes the upstream body; 416 retains Content-Range. No range emulation or
whole-file buffering is used when Vikunja ignores a Range request.

## Quote avatars

`discussionAvatar(username)` requires an app session and returns a raster data
URL or null for an unavailable photo. Only Go calls Vikunja's fixed avatar route;
the optional token capability is `other:avatar`. Requests ask for 64 pixels and
time out after five seconds. Responses are limited to 128 KiB and 512×512 pixels,
with PNG/JPEG/GIF signatures; SVG, redirects and unsafe usernames are rejected.
The browser caches/deduplicates the query in Apollo memory and shows initials
on failure. No extra persistence or binary browser endpoint is introduced.
Quote headers reuse cached original comments. Missing originals require one
lookup per distinct source to display its author, without loading whole pages
or recursively fetching ancestors. This does not block the quoted text.

## Out of scope

No database, server-side reply table, attachment deletion, reaction mutation or
cross-task comment query belongs in this module.
