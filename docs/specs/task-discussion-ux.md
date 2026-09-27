# Task Discussion UX

## Module objective

Make a task's ongoing discussion easy to scan, continue and recover on a phone
or desktop without turning the task editor into a second full page.

## Navigation

### Task detail composition

The task detail page presents the title and description as the primary content,
with a compact properties panel beside it at wide desktop sizes. On smaller
screens the order is title/description, properties, then Discussion. Remove the
generic Task card around all fields. Use the app's existing typography, colors
and spacing rather than copying Linear branding.

Render supported native description HTML through the existing sanitized
read-only renderer. Preserve plain text line breaks and warn about unsupported
content. Description editing remains the existing Edit workflow; no autosave or
new write path is introduced. Show a quiet empty state when absent.

Embed the same discussion thread used by `/tasks/$taskId/discussion` below the
description/properties. Retain the dedicated route and its task context. Share
queries, drafts, reply navigation, uploads and uncertain-save protection; never
mount two composers for one task on the same page. Discussion failures must not
hide task content. Keep loading/errors local to the conversation.

Acceptance: desktop side panel and readable content width; no 320px overflow;
all task actions/recurrence controls retained; embedded posting/replying and
standalone discussion both work; drafts survive route changes without autofill
overwriting typed text. Verify native-description safety, task edit workflows,
mobile/desktop Axe and existing discussion E2E.

Reference: [Linear comments and reactions](https://linear.app/docs/comment-on-issues)
and [editing issues](https://linear.app/docs/editing-issues). Borrow the
description/properties/conversation hierarchy, not inline autosave or native
thread semantics that this application does not implement.

- Add a `Discussion` action to the task detail actions.
- Use a stable route such as `/tasks/$taskId/discussion` with the existing
  `returnTo` behavior.
- Keep task title, project, status and due context visible at the top.
- Keep the composer near the conversation on desktop and reachable above the
  mobile keyboard.

## Conversation behavior

- Oldest-first is the default for a long-running task journal.
- Each comment shows author, relative/absolute timestamp, rendered content and
  available actions.
- Reply opens the composer in reply mode and shows a compact quote preview with
  Cancel reply.
- Each source quote starts with an arrow button named **View original**.
  It scrolls to and focuses a loaded original with a focus ring. If the original
  is outside the current page, fetch that one comment in a dialog; never scan pages.
- Follow an original's quote arrow to continue through a reply chain. Show the
  number of steps and **Back to reply** to retrace the visited comments. Keep
  off-page navigation inside one dialog, not nested dialogs. Closing it returns
  to the comment where navigation began. Page/order changes clear the trail.
- Quote headers reuse cached authors, fetching a missing source once for its
  author. Do not recursively fetch ancestors. Navigation loads an original on
  demand. A failed lookup shows an error and Retry;
  Back and Close still work. Keep the quoted snapshot even if its source was
  deleted. Navigation never replaces the composer or its draft.
- Quote text and source ID remain ordinary Vikunja comment HTML. Following a
  cyclic reference returns to its already-visited position instead of growing
  the trail. Do not copy the entire chain into new replies.
- Edit stays inline where possible; Delete requires confirmation and names the
  comment being removed.
- Failed saves keep content and block automatic/repeated submission. Refresh,
  check whether the comment exists, then explicitly allow a retry. The API has
  no idempotency key, so the UI does not promise exactly-once writes.

## Responsive and accessibility behavior

- The layout must not require horizontal scrolling at narrow widths.
- Main touch targets are at least 44 CSS pixels. The secondary quote-navigation
  arrow is 32×32, beside the original author's name and 24×24 avatar. Quote text
  uses the full width below this header. The avatar falls back to initials while
  loading or when unavailable; unavailable originals show “Author unavailable”.
- Comment focus uses a ring with constant padding, borders and radius. Focusing
  a comment must not change its dimensions or text wrapping.
- Author hierarchy uses size and weight, not only color: main comment authors
  are `text-base font-semibold text-foreground`; quoted authors are
  `text-sm font-normal text-muted-foreground`. The original-comment dialog uses
  the main-author style. Do not dim the entire quote header with opacity.
- Composer, quote preview, status messages and errors have accessible labels.
- Focus moves to the editor after Reply and returns to the triggering action on
  cancel or completion.
- The editor's bottom corners use the container's radius token, so its visible
  focus ring follows the rounded bottom edge. The toolbar-facing top stays square.
- Loading and empty states are semantic, not only visual placeholders.

## Editor and media controls

- Text formats are toggles, with matching icons, accessible labels and a visible
  pressed state derived from the editor selection. With no text selected, the
  format applies to subsequent typing until toggled off; with a selection it
  applies to that text. Moving the caret updates the controls. Pointer, touch
  and keyboard activation return focus to the editor without losing the range.
- **Inline code** formats text within a paragraph. **Code block** changes the
  block for multiline literal code. Text-format/link/table controls are disabled
  in code blocks; **Continue writing** creates a paragraph after the block.
- Heading, quote and list controls show the current block type. Activating an
  already-active block control returns it to a paragraph. **Paragraph** removes
  the current block/list style. Table insertion is disabled inside a table.
- **Undo** reverses an editor change; **Redo** reapplies an undone change. Each
  is disabled when its history is empty. Neither changes a posted comment until
  the user saves. Icons have accessible names and hover labels.
- Link editing retains the selected text while the URL field has focus. Existing
  links preload their URL; without selected text or an existing link, Apply is
  disabled and the panel explains what to select. Removal is enabled only for
  an existing link. Unsafe URLs remain rejected.
- **Restore draft** cannot overwrite new typing. **Discard saved draft** requires
  confirmation and removes only this comment's local saved draft, not posted
  comments or uploaded files. After typing begins, **Dismiss draft notice** only
  hides the recovery notice; the current text and its autosaved draft remain.
  Storage failures keep the recovery notice and report that removal failed.
- Keep common formatting visible and group extended formats under **More
  formatting**. Show language controls only in a code block and row/column
  controls only in a table. Tables and code scroll inside their own containers
  instead of widening the page.
- **Media and attachments** contains the mobile file picker and existing-file
  chooser. Clipboard paste and file drop use the same single-file upload path.
- Upload inserts a pending node and leaves typing enabled. Completion updates
  only that node; deleting it while waiting must not restore it. Posting waits
  until the upload settles. Errors retain the rest of the draft.
- A lost upload response blocks another upload until the user checks existing
  attachments and explicitly allows retry. Reusing a stored file avoids a
  duplicate upload. No write is retried automatically.
- Images expose an alternative-text field; audio/video have native controls,
  metadata-only preload and no autoplay. Removing a reference does not delete
  its task attachment. Explain this before upload and after confirmation.
- Warn when native Vikunja cannot preserve an extended format or player.
  Unsupported native structures remain read-only instead of losing content.

These controls follow [Lexical's selection model](https://lexical.dev/docs/concepts/selection)
and [command dispatch](https://lexical.dev/docs/concepts/commands), using
[accessible toggle-button semantics](https://www.w3.org/WAI/ARIA/apg/patterns/button/).
Application wrappers customize shadcn through props; generated components stay
unchanged.

## Verification

- Browser tests cover desktop and mobile viewport workflows.
- Verify deep links, back navigation, page refresh, delayed comments and a
  missing quoted comment.
- Verify save errors do not reset the editor and repeated Retry does not create
  duplicates.
