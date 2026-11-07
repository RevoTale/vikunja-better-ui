# Today time windows

## Status — withdrawn on 2026-11-03

The user rejected the presentation and requested a rollback to the ordinary
task list. The experimental grouping, column navigation, lines, styles, and
their dedicated tests have been removed. The UI is restored to the committed
baseline. The sections below retain the experiment's history, not current
requirements or evidence for the restored UI.

Work returns to the accepted planning semantics in
[ADR-009](../decisions/0009-task-planning-windows.md). That decision remains
accepted and unimplemented; no task dates or other Vikunja data were changed
by this rollback.

Rollback verification: the frontend source and configuration match HEAD;
`task validate` and `task test` passed (337 frontend tests plus Go race/shuffle
checks). The rebuilt host preview was checked in WebKit at 320, 390, and 1440px:
all eight sample tasks form one aligned list, with no column navigation or
connectors and no runtime errors. No commit was created.

## Rebuild contract — 2026-11-02

The user requested a complete UX review and rebuild after the successive line and
column experiments. This contract supersedes their presentation details; the
accepted task/date semantics and ordinary TaskRow format remain unchanged.

## Findings and research

The previous implementation passed geometry checks while still shrinking the text
area through depth-dependent right padding. Its three separate transforms made
the root, connectors and nested rows harder to reason about. Arrows moved only a
few pixels without revealing the full item, and right-side lines crossed cards.

| Evidence | Application here |
| --- | --- |
| [Apple Layout](https://developer.apple.com/design/human-interface-guidelines/layout): consistent alignment, deliberate indentation, controls distinguished from content | Reuse the actual TaskRow at every level. Keep a single protected control rail. Explain the grouping as time windows, not subtasks. |
| [Apple Scroll views](https://developer.apple.com/design/human-interface-guidelines/scroll-views): expose overflow and current position; avoid nested scrolling with the same orientation | One vertical document; a visible staircase hints at horizontal depth. Explicit Previous/Next and position; no horizontal scrolling or hidden panels. |
| [W3C Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Keyboard focus reveals its time column before the action is used. Focus never moves merely because an arrow was pressed. |
| [W3C Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Navigation has 44px targets at normal text size, above the 24px minimum; controls never overlap task actions. |
| [W3C Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow) | Titles wrap normally inside an unchanged card width. The page never scrolls horizontally. This deliberate two-dimensional time visualization still requires checking clipped content and keyboard reveal; axe alone cannot prove reflow compliance. |
| [WebKit CSS scroll-driven animations](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/) | CSS alone centers navigation on the visible group, respecting header, bottom navigation and safe areas. |

These sources guide the design; none prescribes this particular time-window
visualization. The composition and tradeoffs below are project decisions.

## Interaction and layout

1. Every loaded task appears once in chronological rows within its group. All
   rows remain visible before and after navigation. No collapsed tasks, hidden
   column panels, duplicated titles, End rows, dots, or Vikunja subtask semantics.
2. Root and descendants share one CSS grid and one animated horizontal transform.
   Each item uses the real TaskRow, with its normal padding and date/title/action/
   metadata layout. No per-depth padding, alternate compact template, or width
   animation. Every card and its internal layout has the same available width.
3. A fixed control rail is reserved once per group. Reclaim up to 1rem of existing
   page gutters without entering device safe areas. This keeps mobile text space
   usable; nesting never consumes additional internal padding. Card width comes
   from the container, never a fixed device width.
4. Initial lane offsets make a staircase. A step is at most 1rem; combined depth
   is capped at 6rem and 35% of card width so no row disappears. Root is column 1;
   time lanes, including the root, determine the count. Seven overlapping windows
   therefore have seven columns. Non-overlapping windows reuse columns.
5. Previous/Next selects one column; the entire canvas moves by one step, including
   earlier rows. The selected column fits the content viewport completely.
   Other rows may protrude and clip at its edges. Their widths, wrapping and
   vertical positions do not change. Keyboard Home/End and left/right work on
   the named region. Both arrows remain present and unavailable directions use
   aria-disabled. Reduced motion disables the horizontal transition.
6. A keyboard-focused task link or action reveals its row's column. Pointer focus
   does not move a button under a finger before its click. No task/date mutation
   is caused by navigation. Completion retains the existing semantics and clamps
   the selected column if the maximum depth changes.
7. Left and right connectors share their owner's transform and span from below
   its row to the final row started during its interval. Their outsets are fixed
   spacing tokens (half the control rail on the left, half the right gutter).
   Draw them behind cards, outside task content; covered portions are occluded
   rather than drawn through text or buttons. The current column's connector is
   emphasized, with the position counter providing a non-color cue.
8. Navigation sits on the selected column's left axis. Its vertical position is
   the CSS-computed center of the visible group, clamped inside the group. No
   scroll/resize listeners, geometry measurements, observers or animation-frame
   loops in product code. Browsers without view timelines use bounded sticky CSS.

## Data boundaries

- GraphQL startAt/endAt map to native Vikunja start_date/end_date. dueAt remains
  the hard deadline. No new labels, data storage, API calls or dependencies.
- Group only unfinished, valid, non-overdue tasks with finite positive intervals.
  Missing/equal/reversed/invalid boundaries stay ordinary rows. Preserve server
  root ordering and the loaded page/filter boundaries.
- A contains B if A.start <= B.start and B.end <= A.end, with one strict boundary.
  Choose the smallest containing interval, task ID breaking ties. Equal windows
  are peers; touching boundaries do not overlap. Partial overlaps remain labeled.
- End events precede start events at the same instant. A new interval goes right
  of continuing intervals; columns are reused after they end. Spacing follows
  content, not elapsed time. No actual time spent or busy status is inferred.
- Today inclusion, pagination, filtering, completion/Undo, other views, and the
  unimplemented planning-view semantics in ADR-009 retain their contracts.

## Iteration and verification

1. **Card layout:** compare root and nested date columns, typography, real content
   width and padding at 320–1440px. Inspect light/dark screenshots before proceeding.
2. **Canvas:** verify all rows and titles remain present, equal displacement,
   stable vertical geometry and wrapping, complete reveal of the selected column,
   forward/backward round trip, resize and completion clamping.
3. **Connectors and navigation:** both card-relative anchors, interval endpoints,
   protected controls, CSS centering at group boundaries and multiple scroll
   positions; include a JavaScript-disabled snapshot, enlarged text and safe areas.
4. **Input:** real Tab navigation reveals clipped actions; mouse/touch completion
   does not pan before activation; no horizontal page scrolling, console errors
   or axe violations in controlled fixtures.
5. Run focused browser tests in Chromium/WebKit, then `task validate` and
   `task test` inside the already-running Dev Container after the final edit.
6. Refresh the authorized host preview on port 4181 from the production build.
   Verify the actual host preview through WebKit and inspect final mobile/desktop
   screenshots. Keep code uncommitted.

The isolated full E2E harness starts PostgreSQL and still needs separate Docker
image authorization. Mocked browser tests and the sample-data preview do not
constitute live Vikunja integration proof.

## Rebuild verification — 2026-11-02

- The four time-window browser suites passed all 48 cases across phone WebKit,
  320px Chromium and desktop Chromium after the final source/test edits. They
  cover card/content width, forward/back navigation, connector anchors, CSS
  centering, completion, real Tab traversal, light/dark themes and enlarged text.
- `task validate` and `task test` passed in the existing Dev Container; the latter
  includes 349 frontend tests and the configured Go race/shuffle runs.
- The production build served by the host preview on port 4181 passed a separate
  WebKit check: seven-column round trip, equal card displacement and stable
  dimensions, revealed selected actions, card-relative lines, and CSS centering
  at four scroll positions. Final mobile, desktop and scrolled screenshots were
  inspected. Native Safari UI was not automated.
- The preview uses sample data. Native Safari user acceptance and live Vikunja
  integration remain separate from these checks. No Git commit was created.
