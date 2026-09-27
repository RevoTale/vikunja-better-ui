# Task Discussion Rich Text

## Module objective

Provide one feature-owned Lexical wrapper that works on mobile and desktop and
serializes to the HTML format accepted by Vikunja comments.

## Editor modes

- `create`: empty editor or recovered per-task draft.
- `reply`: starts with a non-editable-looking quote block and places the caret
  after it.
- `edit`: loads the existing HTML, preserving a reply quote if present.

The wrapper owns Lexical configuration, plugins, toolbar, keyboard behavior,
serialization and deserialization. Comment components consume typed callbacks
and never manipulate Lexical internals directly.

### Editor boundaries and CMS reference

The [CMS editor](https://github.com/RevoTale/cms/blob/954a3134e7cdbfa36e5d490a136222de080a0f06/src/payload/components/RichTextMarkdownField/MDXNoSSG.tsx)
uses MDXEditor 4.2.1 (confirmed in its lockfile), CodeMirror-backed code blocks,
and `markdownShortcutPlugin()` after its content plugins. The plugin delegates
typing to Lexical's `MarkdownShortcutPlugin`; the CMS's adjacent custom
`markdownTransformers.ts` is not imported by the active editor. Its Markdown
storage and code editor are not interchangeable with Vikunja HTML.

Keep Better UI on Lexical 0.51.0 with these responsibilities:

- `editor.tsx`: stable composer lifecycle and presentation.
- `editor-extension.ts`: registered nodes, extensions, theme and initial HTML.
- `editor-behavior.tsx` and `editor-clipboard.ts`: editability, focus and safe paste.
- `editor-markdown.tsx`: stable official transformer list and fence-line normalization.
- `editor-code-shortcut.ts`: immediate typed-fence conversion and its input guards.
- `editor-toolbar.tsx` and focused code/table/link tools: user actions and controls.

Use the [official shortcut plugin](https://lexical.dev/docs/packages/lexical-markdown#shortcuts),
not a copied Markdown parser. The transformer array stays stable across React
updates so typing does not repeatedly unregister/re-register shortcut listeners.
Typing the third backtick on an otherwise empty final line of a root paragraph
opens a plain-text code block immediately. Choose its language afterward, rather
than typing a language suffix after the shortcut. Detect only the same-node
two-to-three-backtick transition with a collapsed caret at the end. Imported
or pasted complete fences, range replacements, inline-code text and undo/redo
must not trigger it. Clipboard insertion carries Lexical's `PASTE_TAG`, including
a pasted single third backtick. Active IME composition is never converted.
Keep conversion as a separate, bounded history update, like the official
shortcut plugin, so Undo restores all three literal backticks. Do not scan the
whole document or run another update for ordinary typing.

Before unmodified Enter/Space, a complete code fence on the final soft line of
a root paragraph is separated into its own paragraph. Lexical then performs
the normal conversion. Preserve preceding nodes and their formatting; do not
normalize selections, mid-text cursors, nested blocks, inline-code literals,
non-simple text nodes or existing code blocks.
Shift+Enter and IME composition remain untouched. No automatic Markdown import
is applied to pasted plain text. Enter/Space can explicitly convert a pasted
bare or language-qualified fence. These rules are independent of CMS's behavior
for soft lines; only its source/configuration was inspected, not a running CMS.

### Typography

The composer and read-only body share `discussion.css`, using Tailwind 4.3.3
utilities through `@apply` and `@reference` to the application theme. No typography
plugin is required. Body text uses `text-base` with relaxed leading; code blocks
use `text-sm`, normal leading and the configured monospace family. Inline code
is 0.875em of surrounding text; code inside a block inherits the block size
instead of shrinking twice. Block code must have `display: block` because
Lexical 0.51.0 renders its code node as a `code` element, not a `pre`.

Headings use Tailwind's 2xl/xl/lg/base scale. Saved headings remain semantic h3
sections under the discussion page but retain their original visual level via
a renderer-owned attribute. List indentation, checklist markers, table cells
and block padding use em units. Code and tables scroll horizontally within
their container without widening the page. Generated shadcn files are untouched.

Sources: [Lexical update listeners](https://lexical.dev/docs/concepts/listeners),
[update tags](https://lexical.dev/docs/concepts/updates),
[Tailwind directives](https://tailwindcss.com/docs/functions-and-directives).

## Supported content

The approved editor supports paragraphs, headings, bold, italic, inline code,
bulleted/numbered lists, blockquotes and safe links, plus code blocks with
language selection/highlighting/copy, tables, checklists, separators, Markdown
shortcuts, underline, strikethrough, highlight and sub/superscript. Code-block
paste inserts literal plain text, preserving whitespace instead of importing
clipboard HTML. The reply quote uses:

```html
<blockquote data-comment-id="123">…</blockquote>
```

Only one top-level reply quote is created by the Reply action. Users may still
write normal blockquotes in the body, but those do not become reply metadata.

## Safety and persistence

- Sanitize incoming and outgoing HTML with a strict allowlist.
- Allow only `https`, `http`, and `mailto` links unless a later decision expands
  this list.
- Add `target="_blank"` and `rel="noopener noreferrer"` only where the
  application chooses to open external links in a new context.
- Persist drafts under a versioned, task-scoped localStorage key.
- Scope keys by author, task, and edited comment, using
  `vbu:discussion:v1:<author>:<task>:<comment-or-new>`. Draft reads and writes share
  a 100,000-character limit; submission has a 100,000 UTF-8-byte limit.
- Storage is optional and fail-open. A storage error must not block typing or
  comment submission.
- Never replace non-empty current editor content with a recovered draft without
  explicit user action.

## Verification

- Round-trip supported Lexical states through HTML without losing reply quotes.
- Reject unsafe URL schemes and dangerous HTML attributes.
- Recover drafts after reload and preserve manually edited content.
- Verify keyboard navigation, focus placement after Reply, mobile viewport
  resizing and accessible labels.

## Dependency boundary

CMS's MDXEditor is a reference, not a runtime dependency. Use the current
[Lexical extension composer](https://lexical.dev/docs/api/modules/lexical_react_LexicalExtensionComposer)
with rich-text, list, link and history extensions. Keep the root extension stable
so React updates never replace entered content.

[DOMPurify](https://github.com/cure53/DOMPurify) performs allowlist sanitization
before import, export and display. Display maps the sanitized DOM to React
elements, without `dangerouslySetInnerHTML`. Unsupported tags, event handlers,
styles and unsafe links are not rendered. A reply's first source quote
is stored separately from the editable body so editing cannot lose its ID.
Imported plain/inline-only text uses Lexical insertion normalization, never
direct root append. File paste/drop creates a separate upload placeholder;
completion replaces only that node and never a snapshot of the whole document.
Unsupported native content (including nested tables and arbitrary remote
media) disables Edit and shows a native-Vikunja notice. Supported tables,
code, checklists and text formats must round-trip without silently losing data.

## Approved attachment extension

The final verification record determines what has been tested. Upload,
paste/drop and mobile picker store media as Vikunja
task attachments. A single upload is limited to 20 MiB; the upstream may impose
a smaller limit. Uploads are authenticated GraphQL multipart requests with an
exact Origin and CSRF header checked before parsing. Metadata stays GraphQL.
Binary streaming uses the approved same-origin `/media/tasks/{task}/attachments/{id}`
exception, with authenticated sessions, upstream access checks, MIME allowlists,
no redirects/arbitrary URLs, bounded memory and private no-store responses.

Vikunja 2.5.0's native editor serializes API v1 attachment URLs in `src` or
`data-src`, although Better UI's API transport is v2. Preserve source references
separately from authenticated display URLs. Removing a media reference, undoing
its insertion or abandoning a draft never deletes the underlying attachment.
Uploads are not automatically retried when the result is uncertain.

Image nodes preserve native `data-src` and alternative text. Audio/video export
as ordinary attachment links with a media-kind attribute: native Vikunja keeps
the usable link even without a player extension. Its editor may drop the marker
on save. Native 2.5 also lacks highlight/subscript/superscript nodes; the composer
warns about editing these formats there. Do not claim lossless interoperability
for unsupported native extensions.

Match pinned upstream MIME capabilities: reject FLAC with a final STREAMINFO
first block before upload. Vikunja 2.5 classifies it as octet-stream, which must
not be enabled for inline serving. Free-format MP3 detection is also outside
the supported subset; no transcoding is provided.

HTML with styles that Better UI cannot retain (alignment, color, sizing),
disclosure blocks, nested tables or remote media disables Edit. Pasting such
content shows an explicit warning while inserting the safe supported subset.
Image-only comments and drafts are valid. Reply/deletion excerpts use image
alternative text, or an attachment label when alternative text is empty.

The composer and code highlighter are lazy-loaded; the read-only discussion
does not instantiate a Lexical editor per comment. Markdown typing uses Lexical's
official transformers (for example `[ ] ` without a preceding bullet marker).
