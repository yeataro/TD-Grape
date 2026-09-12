# Touch graph editing

The canvas has one touch gesture controller. Mouse and pen continue through the
existing desktop pointer handlers. The established shared HTML/SVG world
coordinate conversion is unchanged.

## Gestures

| Touch gesture | Action |
| --- | --- |
| Tap a node | Select it and show Parameters |
| Drag a node title or body | Move that node, or the selected group |
| Drag a socket onto a compatible socket | Connect; either direction is supported |
| Tap one socket, then the other | Connect; tapping the armed socket again cancels |
| Drop a wire on blank canvas | Open Add Node with compatible choices |
| Double-tap blank canvas | Open Add Node |
| Double-tap a Subgraph | Enter the Subgraph |
| Double-tap the node Label | Focus its Parameter editor |
| Hold a node or blank canvas | Open the graph context menu |
| Hold a wire | Open the context menu with Disconnect |
| Drag blank canvas | Pan, or select a rectangle when Box Select is enabled |
| Use two fingers | Pan and zoom around their midpoint |

Movement starts after 8 CSS px, a hold after 550 ms, and a double-tap uses a
320 ms / 24 CSS px window. A socket is reserved for connecting and does not
open a context menu on hold. Touch connection targets allow 22 CSS px proximity
without enlarging the visible socket; mouse proximity remains 14 CSS px.
Context-menu rows have at least 44px height when opened by touch.

## Gesture ownership and cancellation

Node dragging only previews DOM positions until release; the graph is not
modified or sent to TD during the drag. A completed move creates one Undo step
and uses the existing save/apply path. Connections reuse the existing type,
cycle, occupied-input and Undo rules.

Adding a second finger cancels an unfinished node or wire preview and starts
anchored pinch navigation. Lifting one finger continues as pan; lifting the
last finger cannot accidentally connect or open Add Node. Movement cancels a
pending hold. Releasing after a hold does not choose an item from its menu.

Pointer cancellation, capture loss, window blur, hidden document, resize,
rerender and Escape cancel pending editing. A second touch outside the canvas
also cancels its pending edit. No canceled drag adds history or leaves orphan
wires. Read-only graphs reject touch mutations.

## Browser behavior

Canvas descendants disable native touch actions, text selection and WebKit
callouts. Cancelable touch start/move events are prevented only within the
canvas, providing a fallback for older iOS handling of absolutely positioned
elements. Graph text fields are exempted from selection suppression; Parameter,
code and search fields outside the canvas retain native editing.

Compatibility clicks, double-clicks and context-menu events from the same touch
sequence are suppressed to avoid duplicate commands. A real mouse/pen down
clears that suppression immediately.

Relevant platform references:

- [W3C Pointer Events](https://www.w3.org/TR/pointerevents/): touch actions and pointer cancellation/capture.
- [WebKit issue 218015](https://bugs.webkit.org/show_bug.cgi?id=218015): historical double-tap zoom with absolutely positioned elements.
- [WebKit issue 231161](https://bugs.webkit.org/show_bug.cgi?id=231161): text selection and touch callout behavior.

## Verification

```text
node tests/browser/test_touch_editing.cjs src/editor tests/fixtures/editor-state.json <report-directory>
node tests/browser/test_touch_webkit.cjs src/editor tests/fixtures/editor-state.json <report-directory>
node tests/browser/test_navigation_browser.cjs src/editor tests/fixtures/editor-state.json <report-file.json>
```

On Windows, 19 Chromium touch groups and 5 WebKit native-tap groups passed.
Coverage includes preview/commit/cancel, node groups, connections, double-tap,
long-press, context-menu activation, read-only behavior, rotation, an outside
second finger, native input editing and mouse use immediately after touch.
The existing 25 navigation checks and the Chromium/WebKit wire geometry suites
also passed.

Chromium tests dispatch real browser touch sequences through the test protocol;
WebKit tests use native tap automation. These are not physical iPad tests.
The user reported good touch editing behavior on the target iPad mini 6 /
iPadOS 18.7.8 / Chrome 151 on 2026-09-12, after confirming wire alignment. This
is overall user feedback, not exhaustive device coverage of every gesture or
software-keyboard interaction.
