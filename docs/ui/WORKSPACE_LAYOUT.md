# Workspace layout and column creator

The editor retains left sidebar, central graph and right sidebar. Panel titles can move across sidebars. Drop on a group's upper/lower edge to stack it, or its body to combine tabs. Drop on a tab strip to insert at the shown vertical marker, including reordering within the same group. The top 3px of a strip remain a stacking target. Overflowing strips scroll near their edges. Escape or releasing outside a target cancels a move.

Panel headings select and expand their panel in both single-panel and tabbed groups. Repeated clicks never collapse an open panel; the separate right-hand chevron controls collapse. Keyboard activation follows the same rule, and title dragging still moves panels.

The compact Layout menu offers panel visibility, default/named presets, Save layout and Manage layouts. Management supports group placement, tab order, named preset save/apply/update/rename/delete and JSON transfer. It remains usable by keyboard and touch. User-selected groups and preset names stay independent of product defaults.

There are six panels: Add Node, Parameter, Inputs, Custom Parameters, Preview and Help. Hiding a panel retains its group and relative position; revealing it makes its group and sidebar available again. Defaults restore all panels. Layout state is local to each browser, independent of Shader JSON, undo history or compilation.

`grapeWorkspaceV1` holds groups, active tabs, collapse state, widths, desktop sidebar visibility and an optional `hidden` panel list. `grapeWorkspacePresetsV1` holds named configurations. Every panel remains assigned exactly once, even when hidden; malformed imports are rejected before application. Older four/five-panel layouts gain the new tool panels and older layouts without `hidden` remain valid.

Panel tabs use cool neutral UI colors. Active tabs share the content background and use stronger text; inactive tabs are darker. There is no selection underline or reserved underline height. Tabs and selected-node identity headers are 32px high. Category colors apply only to the selected node identity. Collapse controls use a 14px stroke chevron and localized accessible names. Left/right sidebar toggles stay at opposite ends of the location row.

The header is visible by default and can be folded with its dedicated icon at the exact center of the separate location row. Equal flexible regions reserve space on either side: the library toggle and truncatable project/path information stay left, while Layout and the parameter-sidebar toggle stay right. Narrow screens keep this same center alignment. The preference is local to this browser (`sgrapeHeaderVisible`); the footer always remains visible. The brand uses one small `tagline · version · About` line, with English About retained on narrow screens. At widths up to 1100px, the logo/name stay left and Apply Shader right, while Language, Import, Export and Save TD project occupy a right-aligned second header row. Action buttons and selects share a height. Narrow screens retain sidebar overlays.

The canvas toolbar groups Undo/Redo, Copy/Paste/Subgraph/Delete, Fit/Box select and GLSL. Thin separators distinguish groups, which wrap as complete units. On phones, icon buttons, text buttons and Pixel/Vertex controls share a height. Graph breadcrumbs remain in their own row.

The footer keeps the persistent graph-saved, Shader-applied or pending state separate from temporary operation messages. A repeated saved/applied message is displayed once; ordinary operation messages cannot hide errors. Matching successful retries clear their error. The desktop footer is 30px high; narrow screens reserve a second compact line for messages.

A small page-refresh icon sits at the far left of the footer, followed by persistent status. Reload applied graph remains at the right. On narrow screens refresh and persistent status share the first line, with temporary messages on the second line; footer height remains 48px (30px on desktop). It reloads the complete editor page, independently of Preview reconnect and the existing applied-graph reload action. Unfinished numeric/text fields and open dialog drafts block refresh until completed or canceled. In-flight writes also block refresh. If the graph is unsaved, the action verifies a tab-local session draft before confirming reload, then uses the existing explicit draft-review recovery after reconnecting; storage failure leaves the page open.

The floating Add Node browser uses category, result and detail columns. Authored categories currently reach two levels; additional depth adds fixed 170px columns, with horizontal scrolling on small screens. Search crosses category paths; source/type and connection compatibility are independent filters.

The canvas stage/count/help text sits at the lower left; the zoom percentage sits at the lower right, each inset 20px horizontally and 18px from the bottom. Both overlays let pointer actions pass through to the canvas.

The location row shows the current TOE filename and component path. Export offers full-graph JSON download, TD-folder JSON and PNG with embedded graph data. Canvas title Label/provenance placement remains a separate decision.

Validation: `tests/browser/test_editor_chrome.cjs` covers header reopening, desktop/half-width/coarse-phone toolbar layout, persistent states, matching error recovery, unfinished field/modal drafts, in-flight writes and page-reload draft recovery. `tests/browser/test_workspace_layout.cjs` covers existing docking, presets and transfers. `tests/browser/test_ui_refinement.cjs` adds pointer insertion/reorder, hidden-panel persistence, rename, compact Parameter controls, local Subgraph copies and Chinese narrow headers. Both use the portable editor-state fixture. Windows Chromium is verified; physical touch devices and macOS remain unverified.

Live delivery uses `tools/dev/jobs/refresh_sources.py`, preserving Shader state and the connection session. Saving the formal development TOE is a separate step through `save_source_project.py`.
