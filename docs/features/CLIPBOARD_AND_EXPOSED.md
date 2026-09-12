# Editing UX development checkpoint

## Function names

Select a Function call and edit Function Name in Parameter, or use right-click → Rename Function to focus that control. Function Input/Output pages use the same operation. Local definitions retain their ID, ports, edges and values; all call titles, library entries and breadcrumbs read the updated definition name. A source-library rename follows the established first-edit localization rule, retaining the source snapshot and redirecting this Shader's related calls together. Name validation permits 1–80 plain-text characters (including Chinese), trims surrounding whitespace and rejects empty/control-character names. One Undo reverts the rename. Fixed internal IDs, not editable names, are the references. Node aliases are a separate pending feature.

## Clipboard and context menu

Ctrl+C/Ctrl+V copy selected editable nodes, internal edges, saved inputs and the required Function/declaration snapshots. Fixed stage outputs and Function boundaries are excluded. Same-Shader pastes share existing Function and declaration identities; cross-Shader pastes import local snapshots and avoid GLSL declaration-name collisions. Imported native Input 1 bindings currently follow the destination's shared Input settings, or use their default texture when pasted into MAT. Recursive, missing-definition, incompatible-stage, oversized and known-revision-mismatch pastes are rejected as one transaction. The ordinary graph apply/last-success mechanism remains authoritative. Text inputs retain their normal clipboard behavior.

Clipboard events carry plain JSON and do not rely on HTTPS-only clipboard APIs. Right-click Copy also retains an editor-local copy; if the browser cannot read the system clipboard, menu Paste uses that local copy. Use Ctrl+C/Ctrl+V for transfers between HTTP browser tabs. System clipboard contents were not overwritten by automated tests; browser clipboard-event handling was exercised with DataTransfer fixtures.

Short right-click opens Add / Copy / Paste / Duplicate / Create Graph Function / Delete, plus Rename Function when applicable. Right-drag still box-selects. Shift+F10 opens the menu; arrows, Home/End, Enter and Escape work. Paste offsets subsequent copies on the world grid. Undo/Redo restores graph content using existing history behavior.

## Parameter scope

Node shows the selected-node Parameter/Settings. Exposed lists every exposed declaration in the Shader, regardless of selection or Function depth, with current values and collapsible default/Expose settings. Entries that do not currently contribute to output explain why no TD parameter is active. Existing revision/compare-and-set, Expression/Bind ownership and guarded live writes are reused. Global declaration changes do not spuriously localize the Function currently being viewed. Defaults and live TD values remain distinct.

## Value Ladder

Middle mouse continues to open immediately. Alt+right mouse also works. A 450ms left-button or touch hold opens the same Ladder; vertical movement chooses a rung and horizontal movement previews the value. Release commits once. A short touch focuses the field; movement before activation scrolls the Parameter body. Escape, touch cancellation, blur, removal and capture loss restore the initial value. Physical touchscreen/iPad verification remains pending. The numeric field owns touch handling so an activated Ladder can drag reliably; other pane areas keep native scrolling.

Official behavior references: https://derivative.ca/UserGuide/Value_Ladder and https://docs.derivative.ca/Dialogs:Preferences_Dialog . Do not describe a precise preference anchor as verified unless actually checked.

## Validation and delivery

58 isolated Chromium checks passed: Function rename 8, clipboard/menu 12, Exposed 8, actual touch-event/left/Alt-right Ladder 8, and existing middle-Ladder regression 22. Python core compilation verifies that a local name-only edit leaves generated Vertex/Pixel GLSL identical and that a cross-Shader pasted graph compiles. Live integration is read-only; static-resource refresh snapshots current graph/revisions/GLSL and preserves the service port. No private gateway changes, TOE save, GPU rendering policy change or release reseal.

The user confirmed Ctrl+G already handles box-selected nodes. Uniform-in-Function is still a discussion: it remains a Shader-wide declaration even when its node is grouped. No policy change was approved. Likewise, leave the existing flattened GLSL code view unchanged while the user explores it.
