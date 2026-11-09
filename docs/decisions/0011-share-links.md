# ADR-011: Share existing links without changing access

Accepted 2026-11-09. Specification: [Share links](../specs/share-links.md).

1. The user requested Share for tasks, comments and pages with their filters,
   leaving placement and format to implementation. The need is to return to or
   send the exact context without reconstructing the filter or locating a comment.
2. Place a compact Share control in the authenticated top bar (including task
   detail) and comment action footer next to Reply. Preserve existing Copy comment link.
3. Share a URL using the device share sheet when supported, otherwise copy it.
   Cancellation does nothing. If automatic sharing/copy fails, show a selectable
   URL. Never claim that delivery occurred merely because a share sheet opened.
4. Page links retain current search parameters, including filters, ordering,
   period and pagination, but omit navigation-only returnTo. Task links are
   /tasks/{id}; comment links use the existing discussion?comment={id} route.
5. No public-access grants, native link-share creation, persistence or new API.
   Existing authentication and permissions apply when the recipient opens a link.
   Task lists and computed occurrences keep their existing card layout. Creation/edit drafts are not shareable page state.

Implementation correction: an initial Share icon in task metadata made longer
project labels wrap into an extra row at 320px. Existing geometry tests caught
this. Keep task Share in detail instead; do not widen cards, shrink labels or
weaken skeleton/layout assertions to accommodate an extra list action.
