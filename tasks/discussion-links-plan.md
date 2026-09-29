# Discussion links, compact cards, and overdue ordering

Approved scope: transform links while editing and persist the resulting HTML;
published comments never fetch titles. Preserve unrelated in-progress plans.

## Contract

- Pasted complete HTTP(S)/www URLs link immediately. Typed URLs link after Space
  or Enter. An incomplete scheme is text. Code remains literal.
- Same-origin Better UI `/tasks/{id}` links (including discussion/edit routes)
  resolve through GraphQL to a saved title snapshot. External URLs remain links;
  no arbitrary URL fetching, new dependency, or additional persistence.
- Resolution is optional: errors never block posting. Custom labels, removed
  links, subsequent edits, undo, and submitted drafts must not be overwritten.
- Published HTML keeps its saved label; legacy plain URLs remain display-only
  links. No load-time title requests or content rewrites.
- Compact card spacing and Reply footer while keeping 44px touch targets.
- Overdue: priority descending, then due instant ascending, then deterministic
  title/ID ties. Preserve calendar-day grouping and future chronological order.

## Ordered slices

1. URL recognition and editor linking, regression-first; reuse installed Lexical.
2. Optional task-title resolution and race protection through existing GraphQL.
3. Compact discussion cards and matched loading placeholders.
4. Audit all overdue sort paths; cover equal-priority due-time ordering.
5. Browser tests, review/fix/simplify, documentation, full project gates.

## Verification

Focused Vitest and Go tests; real Vikunja Playwright on phone/desktop; then
`task gen:check`, `task validate`, `task test`, `task e2e` in the existing container.
Do not commit or push.

## Implementation references

- [Lexical node transforms](https://lexical.dev/docs/concepts/transforms): synchronous
  document changes run as transforms, not update-listener rendering waterfalls.
- [Lexical listeners](https://lexical.dev/docs/concepts/listeners): title lookup
  starts after commit; later edits invalidate the pending result.
- Installed Lexical `extension-core/types.ts`: extension `register` runs before
  initial state import. This avoids reprocessing imported code blocks on mount.
