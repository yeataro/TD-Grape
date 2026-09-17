# Experimental canvas trash

The experiment adds a drop target to the lower-right canvas corner, above
the zoom, Fit, focus and fullscreen controls. It has no sockets and
does not participate in the graph. It defaults to off and can be enabled from
the footer gear under Experimental features.

The trash stays a small, subdued circle at rest and retains that size when a
drag begins. Its transparent detection region is fixed at 84px (96px for touch),
larger than the visible 44px (48px for touch) face. Only an eligible hover scales
the face to 1.2 times its size and lifts the lid; the bin icon remains visible.
Animation never changes the hit region. Release instructions appear at the
bottom center of the canvas, matching other operation hints, with a muted red
background for a pending deletion. Eligible nodes or the affected wire are
also highlighted. A small wire badge follows
the pointer when dragging a wire body, so the operation is visible without
moving its source or destination nodes. The trash is a drop target, not a
click-to-delete button; toolbar Delete remains the accessible direct action.

## Drop semantics

| Dragged item | Release over trash |
| --- | --- |
| A node or selected node group | Delete eligible nodes and their attached wires |
| A wire body | Disconnect exactly that wire; preserve sibling branches |
| An occupied input socket | Disconnect its incoming wire |
| An empty input or output socket | Cancel this new wire drag; preserve existing branches |
| A fixed stage output or Function boundary | No deletion or move; show the protected state |

Mixed selections retain protected nodes in their original positions and show
the number of eligible nodes that will be deleted. This does not delete shared
Uniform/declaration/Function definitions. Source ownership and grouping rules
are unchanged.

## Commit and cancellation

Hovering only previews. Dropping commits one Undo step; undoing a node deletion
restores its original position and attached wires. Desktop node movement now
uses DOM previews, like touch movement, so the drag itself does not edit or
save graph state. A normal drop elsewhere still commits the node move. Moving
a wire body elsewhere leaves the connection unchanged.

Dragging out cancels the trash action. Escape, pointer cancellation, capture
loss, blur, resize, rerender, or a second touch cancel the pending interaction.
Read-only graphs reject mutation. Commit verifies that the graph and stage
still match the drag's origin. Existing blank-canvas Add Node behavior remains,
except that dropping on the trash area cancels the new wire instead.

No type rules or shared node/wire coordinate math changed. Touch long-press,
double-tap, pan/zoom and mouse/keyboard selection retain their separate roles.

## Experimental preference

`src/editor/graph_ui.js` defines the `canvasTrash` default as `false`. The footer
Experimental features panel changes it immediately and saves the override only
in this browser. It is not a TD parameter, URL option, graph or Layout setting.
Reset defaults restores the disabled state without changing graph history.

- `true`: retain the current trash experiment.
- `false`: hide the trash and disable its hit detection, highlighting, proxy
  and drag-to-trash deletion. Toolbar Delete, copy/paste, grouping and Undo
  remain available. Dragging a node through the former trash area is a normal
  node move.

When the parameter is `false`, an occupied input can instead be disconnected
by dragging its wire onto blank canvas and releasing, or by selecting the
input and then clicking/tapping blank canvas. The original connection remains
during the gesture; disconnect commits once and is undoable. Escape, blur,
an invalid node/wire target, and dropping outside the canvas preserve it.
Unconnected inputs and outputs retain the compatible Add Node flow.

Derivative's [Getting started](https://docs.derivative.ca/Getting_started)
documents the occupied-input-then-empty-space disconnect interaction; its
[Wire guide](https://derivative.ca/UserGuide/Wire) describes both click-click
and drag-release wiring. The Editor applies the disconnect rule to both mouse
and touch, with the same cancel/Undo protections as its other gestures.

The user reported good phone behavior for the trash and asked to retain it
provisionally; iPad and touchscreen-monitor evaluation remain pending.

## Verification

```text
node tests/browser/test_graph_trash.cjs src/editor tests/fixtures/editor-state.json <report-directory>
```

The enabled-mode fixture explicitly enables the internal parameter, independently
of the current default. The Chromium run covers actual browser touch sequences and mouse
drags: 16 scenario groups. Set `TEST_BROWSER=webkit` to run 8 mouse scenario
groups in WebKit. Coverage includes release/hover separation, Undo, exact-wire
deletion, output branches, protected/mixed selections, readonly state, and
cancellation paths. The existing 19 touch editing checks, 25 navigation checks,
10 WebKit shortcut checks and 7 Chromium / 6 WebKit geometry checks passed.
The blank-canvas test point was moved away from the newly reserved trash area.

These are isolated fixture tests, not physical iPad validation of the trash
experiment. The first user feedback on target size and hover appearance is applied above;
further physical iPad feedback on this refinement and wire grabbing is pending.

For the disabled configuration, run:

```text
node tests/browser/test_graph_trash_disabled.cjs src/editor tests/fixtures/editor-state.json <report-directory>
```

This fixture serves the source with `canvasTrash: false`, without modifying
production settings. Thirteen Chromium touch/mouse groups and seven WebKit
mouse groups passed, covering hidden trash, ordinary node movement, both
input-disconnect gestures, cancellation, unchanged Add Node flows, and
toolbar Delete/Undo. The enabled configuration's sixteen Chromium trash
groups also passed.
