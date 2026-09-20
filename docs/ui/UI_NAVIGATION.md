# UI navigation development checkpoint

## Navigation trials and connected selection (0.8.162)

The browser-local “Arrow navigation mode (trial)” selector offers three alternatives. Switching modes clears navigation memory, preserves canvas DOM, and does not edit graph/history data. All plain-arrow modes require one selected node; input fields, menus, dialogs, gestures, placement and modified arrows retain their own handling. The independent view options below work in every mode.

| Mode | Behavior |
| --- | --- |
| Original path | The original 0.8.158 behavior below, retained for comparison. |
| Bidirectional branches | Uses connections and retains a separate reference for the latest horizontal move, including after a return. |
| Spatial neighbors (default) | Uses current node centers, without connection/history requirements. Searches the pressed direction, preferring its forward 90-degree sector, then nearest distance; if that sector is empty, permits diagonals in the same half-plane. Ties use Y/X/ID. No wraparound. |

In bidirectional mode, each successful horizontal move records its origin and direction separately from the return-path stack. Up/Down searches that origin's adjacent nodes by current Y/X/ID order, including after retracing a step. For A → B and C → B, A → Right → B → Left → A → Up/Down can now reach C. Reversing the latest horizontal move returns to its actual origin, including a lower branch selected with Up/Down.

Ordinary nested backtracking still uses the existing stack. Switching peers after a return starts a fresh path from their shared neighbor, since earlier history belongs to the old branch. This also permits a shared input that appeared earlier in the route. Connection modes start with Left/Right after a fresh mouse selection. Deleted connections, graph/Stage/subgraph changes, selection changes, and mode switches invalidate navigation memory. The independent branch anchor is validated even when the return stack is empty. All modes search on keypress, without a presorted cache.

Ctrl-arrow selection works in all three modes, starting from one or more selected nodes in the current graph/Stage/subgraph. Empty and wire-only selections do nothing. Group membership is not a connection; readonly graphs permit selection. Iterative adjacency traversal uses O(V + E) work and terminates on duplicates/cycles/dangling edges. It does not write graph data, Undo, or TD state, rebuild canvas cards/wires, or move the viewport.

| Shortcut | Default result |
| --- | --- |
| Ctrl + Left | All upstream nodes, including starting nodes. |
| Ctrl + Right | All downstream nodes, including starting nodes. |
| Ctrl + Up | Entire connected components of all starting nodes, following both directions. |
| Ctrl + Down | Every node in the current graph outside those connected components. May clear selection if nothing remains. |

The separate “Ctrl + Left/Right: grow selection one step” experiment defaults off. When on, Left/Right keeps the current selection and adds all its immediate upstream/downstream neighbors. Each press snapshots the selected starts before expansion, so newly added nodes expand only on the next press. Multiple selections, isolated starts, merges and direction changes work the same way; endpoints keep selection. This corrects 0.8.161's replacement behavior. Up/Down always keeps its full-component meaning. Key repeats are suppressed for Ctrl-arrow selection so holding Down cannot toggle the complement, and growth advances once per press. Shortcut Help reflects the active navigation and depth modes. L and Shift+L retain both original auto-arrange commands; neither Alt+L nor Ctrl+L is bound.

### View after plain-arrow navigation

The independent selector offers keep the view (default), animated Frame, animated Center, and instant Center. Frame calls `fitNodes` to pan and fit bounds; the separate `centerNodes` capability only pans at the current zoom. Center supports animation or immediate positioning independently of arrow navigation. Both share bounds and camera interpolation, not sizing behavior. Animated navigation choices animate even when general Frame damping is disabled; animated Frame uses its configured duration, Center uses 333 ms. H/F behavior is unchanged. Escape or a new pointer gesture can cancel motion; subsequent arrows retarget the view. Preferences never modify graph/history or rebuild nodes/wires. An old enabled `arrowNavigationFrame` preference maps to animated Frame; the old disabled default maps to keeping the view. Existing explicit navigation-mode preferences are preserved; new/reset preferences use Spatial.

Ctrl+Enter toggles graph focus from the canvas; press it again to restore the layout. Escape remains cancellation/dismissal only and no longer exits graph focus. Text editors retain their Ctrl/Cmd+Enter commit behavior; dialogs, IME composition, repeated keys and active gestures do not toggle focus. Alt+Enter remains browser fullscreen.

Command shortcuts display Ctrl on Windows/Linux and Cmd on Apple platforms. Platform detection uses `navigator.userAgentData.platform` when available, then `navigator.platform`, then the user agent; it does not infer the OS from browser name alone. The same modifier label is used in shortcut Help, buttons, experimental settings and supported clipboard/text-editor hints. Both Control and Meta dispatch the new command shortcuts. Literal Ctrl-only numeric-drag modifiers remain literal, matching their existing behavior. Tests simulate platform metadata and exercise Control/Meta dispatch in Chromium on Windows; physical macOS/Safari validation is explicitly pending user review.

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
