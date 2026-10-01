# Discussion update checklist

- [x] URL parsing tests: schemes, localhost/IP/ports, punctuation, unsafe input.
- [x] Editor links: paste, Space/Enter, code exclusions, custom labels, undo.
- [x] Task-title snapshots: successful lookup, failure, edit/removal/save races.
- [x] Compact comment/footer and skeleton spacing, mobile touch targets.
- [x] Overdue priority/due-time ordering across Today, Jobs, Week.
- [x] Real-browser regressions and saved HTML round trip.
- [x] Review, fixes, simplification, re-review.
- [x] Documentation and final generation/validation/unit/E2E checks executed.
- [x] Full E2E gate green: CI run 36789208186 passed all 320 tests at
  `24c0dff`; see [the status index](README.md).

## Review notes

The results below record the earlier implementation checkpoint, not the current
CI status. The subsequent green CI above closes the historical runtime blocker.

- Reused server overdue ordering in Week rather than duplicating its comparator.
- Removed the redundant Reply access check; kept the 44px target without extra padding.
- Preserved the existing text node when creating links to retain the caret.
- Require whitespace at the live caret, not merely later in the paragraph.
- Start optional title requests after the link commit; ignore late results after
  edits, undo, removal, submission, or unmount. Published rendering makes no lookup.
- Register links in the existing Lexical extension before initial HTML import,
  not a later React effect. This removes a plugin and preserves code whitespace.
- Enter handles a caret before existing trailing whitespace as a URL boundary.
- The Job display test now asserts overdue or scheduled presentation according
  to the actual deadline rather than assuming today's noon is always future.
- Shared URL recognition between the editor and legacy display; only HTTP(S)
  candidates and same-origin task IDs can trigger the respective transformations.
- Focused result: 38 frontend tests and the Go overdue regression passed.
- `task gen:check`, `task validate`, and `task test` passed; frontend: 236 tests,
  backend: all packages with the race detector.
- Final `task e2e`: 266 passed, 1 failed. All 15 new link browser cases passed.
  The remaining test is `discussion plays an uploaded video with native controls
  and no autoplay` on desktop Chromium: `locator.evaluate: Target crashed`.
- The same video crash reproduced with the new link plugin removed. WebKit
  playback passed. No media test, assertion, or browser configuration was weakened;
  the desktop playback failure remains unresolved and blocks an all-green claim.
