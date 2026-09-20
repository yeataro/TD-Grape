# UI navigation development checkpoint

## Arrow navigation (0.8.158)

With one node selected, Left/Right follows direct connections. A fresh step chooses the uppermost neighbor (ties use X then node ID); reversing direction retraces the actual path through multi-input nodes. Up/Down switches the destination of the latest step among that origin's neighbors, preserving its origin and earlier steps. After a fresh mouse selection, first use Left/Right to establish a step. There is no wraparound; parallel edges to the same node are one stop. Multiple/empty selections and selected wires do not enter this node navigation mode.

Candidates are searched on key presses, never presorted. The temporary route belongs to the current graph, Stage and subgraph; replacement, selection changes or deleted connections invalidate stale records. Graph data, Undo, GLSL and TD synchronization are unchanged. Text fields, menus, dialogs, active gestures and modified arrows keep their own handling. Existing Alt+Up still exits a subgraph.

The browser-local “Frame on arrow navigation” option defaults off. When enabled, only successful moves call the existing Frame behavior and use its optional transition. Shortcut Help includes both horizontal traversal and vertical branch switching.

This is development after sealed v0.6.3; old release archives remain unchanged.

## Implemented

- Wire target feedback in both directions. One shared hit rule uses a 14 CSS-pixel radius, type conversion compatibility and acyclic graph validity. Directly hitting an invalid port never chooses a nearby valid one. The highlighted destination is the endpoint used on release; ready previews snap to its center. Existing input connections are replaced in one undoable action.
- Drag cleanup on Escape, pointer cancellation, capture loss, blur, and rerender. Wheel zoom refreshes the candidate under the pointer. Candidate ports are selected once per gesture and move updates are coalesced with requestAnimationFrame. No graph edits or shader compilation happen on hover.
- Basic touchscreen navigation: anchored two-finger zoom from 25% to 170%, one-finger pan on background, and taps on nodes/ports. A pinch does not create graph edits, undo entries or accidental Creator dialogs. Normal browser navigation outside the canvas remains available.
- Scrollbar colors centralized in CSS (`--scroll-track`, `--scroll-thumb`, `--scroll-hover`); Live preview has a visible divider from Parameter. Existing panel positions retained for review.
- Original offline grape favicon in `src/editor/favicon.svg`. Embedded as `favicon_svg`, served as `image/svg+xml` at `/favicon.svg`. Installer/refresh mappings include it; the private external debug adapter has its own allowlist addition. No font/CDN dependencies.

## Touch scope

This first touch layer supports navigation and taps. It does not implement single-finger node repositioning, touch wire dragging, or touch numeric scrubbing. Mouse and pen editing remain supported. The browser test uses real Chromium multi-touch dispatch, but physical touchscreen ergonomics remain unverified.

## Validation

- 25 Chromium browser checks cover forward/reverse proximity, exact visual endpoint alignment, invalid types, float splat, cycles, cancellation paths, replacement and Undo, empty-drop Creator, zoom boundaries, zoom during wire drag, touch anchoring/pan/cancel/tap, CSS styling, localization and SVG decoding under the editor's Content Security Policy.
- Existing editor edit tests passed: copy-on-write/capacity failure rollback, Undo/Redo, read-only behavior and successful edit history.
- A separate native TD Shader was edited through the real browser, auto-applied and compiled by TD. GPU sample for `[.2,.3,.4,.9] + .1` was `[.3019608,.4,.4980392,1]`, within 8-bit quantization of `[.3,.4,.5,1]`.
- Formal MAT/TOP graphs, revisions, IDs, GLSL, and Uniform values/modes remained unchanged. Test workspace removed. TDFam and manager remained healthy.
- 17 private-gateway checks passed through the same computer's Tailscale IP. Local and remote favicon responses matched. A second remote device was not tested.
- Clean incremental `TD-Sgrape-v01-test.29.toe` saved at 2026-09-10 03:09:25 Asia/Taipei. Private helper excluded from the file and restored in memory; development bridge disabled in the saved file. This development TOE has not been reopened in a fresh TD process.

Reproducible browser harness: `tests/browser/test_navigation_browser.cjs SOURCE_DIR STATE_JSON REPORT_JSON [OVERLAY_DIR]`. Supply an authenticated read-only TD state snapshot; the harness serves its own isolated HTTP fixture and never writes to TD. Set `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` when needed. Native readback reports live in ignored `research/navigation-native-tests.json`; private browser sessions remain outside deliverables.

## Next

Implement the TD component-path Shader selector with draft handling and same-origin remote compatibility. Then evaluate Value Ladder. Category/tabs and Function terminology remain proposals; generic Add inference, historical revision policy, and expanded touch editing are not part of this checkpoint. The original review queue is preserved in the private historical archive. Current follow-up notes are in [Next UI notes](../discussions/NEXT_UI_NOTES.md).
