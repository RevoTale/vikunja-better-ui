# Share links

Implemented under [ADR-011](../decisions/0011-share-links.md).

- Page: top-bar icon named Share page. Click after choosing filters to share the
  current URL with its query and hash, excluding returnTo. No creation/edit draft
  fields, credentials or content are serialized. Links reflect current data when
  opened; they are not snapshots. Task detail labels this control Share task.
- Task: Share task icon in the task detail top bar.
  It points to /tasks/{id} without the sender's navigation context.
- Comment: visible Share beside Reply points to the existing deep-link route.
  Off-page comments use the existing direct comment navigation. Copy link in the
  comment menu remains available for users who specifically want the clipboard.
- Use native navigator.share in the click handler where available; fall back to
  clipboard when unsupported or failed. AbortError means cancellation, not failure
  or permission to copy. Clipboard success announces Link copied. If unavailable,
  an accessible dialog contains a selectable read-only URL for manual copying.
- Controls retain 44px touch targets, keyboard focus and current card appearance.
  No new dropdown, dependency or backend request. Native sharing is feature detected
  rather than inferred from screen size; secure-context/platform restrictions apply.

Source: [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).
Browser verification: frontend/e2e/sharing.spec.ts covers filters, canonical task
and comment links, cancellation, manual fallback and 320px overflow. Native OS
share destinations cannot be verified by a mocked browser invocation.

Verification (2026-11-09): independent review and follow-up review passed. Final
`task validate`, `task test` (374 frontend tests plus Go race/shuffle),
`task gen:check` and `task e2e` passed; the full browser matrix has 234 passing
scenarios. Inspected the 320px screenshot. Existing non-failing Go module-cache
and WebKit stylesheet CSP warnings remain. Native OS share destinations were not
manually exercised; API cancellation and clipboard/manual fallbacks are covered.
