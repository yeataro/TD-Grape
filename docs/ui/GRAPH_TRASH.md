# Experimental canvas trash

The current experiment adds a drop target to the lower-right canvas corner.
It has no sockets and does not participate in the graph. The zoom percentage
moves to the right end of the graph navigation row. This is an enabled UX trial
for user feedback, committed separately from the established toolbar actions.

The target is subdued at rest. During a drag it grows to 64px (80px for touch);
an eligible hover turns it red with an X and a release instruction. Eligible
nodes or the affected wire are also highlighted. A small wire badge follows
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

## Verification

```text
node tests/browser/test_graph_trash.cjs src/editor tests/fixtures/editor-state.json <report-directory>
```

The default Chromium run covers actual browser touch sequences and mouse
drags: 16 scenario groups. Set `TEST_BROWSER=webkit` to run 8 mouse scenario
groups in WebKit. Coverage includes release/hover separation, Undo, exact-wire
deletion, output branches, protected/mixed selections, readonly state, and
cancellation paths. The existing 19 touch editing checks, 25 navigation checks,
10 WebKit shortcut checks and 7 Chromium / 6 WebKit geometry checks passed.
The blank-canvas test point was moved away from the newly reserved trash area.

These are isolated fixture tests, not physical iPad validation of the trash
experiment. User feedback on target size, location and wire grabbing is pending.
