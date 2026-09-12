# Workspace layout and column creator

The editor retains left sidebar, central graph and right sidebar. Panel titles can move across sidebars. Drop on a group's upper/lower edge to stack it, or its body to combine tabs. Drop on a tab strip to insert at the shown vertical marker, including reordering within the same group. The top 3px of a strip remain a stacking target. Overflowing strips scroll near their edges. Escape or releasing outside a target cancels a move.

The compact Layout menu offers panel visibility, default/named presets, Save layout and Manage layouts. Management supports group placement, tab order, named preset save/apply/update/rename/delete and JSON transfer. It remains usable by keyboard and touch. User-selected groups and preset names stay independent of product defaults.

There are six panels: Add Node, Parameter, Uniforms, Custom Parameters, Preview and Help. Hiding a panel retains its group and relative position; revealing it makes its group and sidebar available again. Defaults restore all panels. Layout state is local to each browser, independent of Shader JSON, undo history or compilation.

`grapeWorkspaceV1` holds groups, active tabs, collapse state, widths, desktop sidebar visibility and an optional `hidden` panel list. `grapeWorkspacePresetsV1` holds named configurations. Every panel remains assigned exactly once, even when hidden; malformed imports are rejected before application. Older four/five-panel layouts gain the new tool panels and older layouts without `hidden` remain valid.

Panel tabs use cool neutral UI colors. Active tabs share the content background and use stronger text; inactive tabs are darker. There is no selection underline or reserved underline height. Tabs and selected-node identity headers are 32px high. Category colors apply only to the selected node identity. Collapse controls use a 14px stroke chevron and localized accessible names. Left/right sidebar toggles stay at opposite ends of the location row.

At widths up to 1100px, the first header row keeps the logo/name left and Apply Shader right. Language, Import, Export and Save TD project occupy a right-aligned second row, wrapping only if necessary. About, subtitle and version hide in this mode. Narrow screens retain sidebar overlays.

The floating Add Node browser uses category, result and detail columns. Authored categories currently reach two levels; additional depth adds fixed 170px columns, with horizontal scrolling on small screens. Search crosses category paths; source/type and connection compatibility are independent filters.

The location row shows the current TOE filename and component path. Export offers full-graph JSON download, TD-folder JSON and PNG with embedded graph data. Canvas title Label/provenance placement remains a separate decision.

Validation: `tests/browser/test_workspace_layout.cjs` covers existing docking, presets and transfers. `tests/browser/test_ui_refinement.cjs` adds pointer insertion/reorder, hidden-panel persistence, rename, compact Parameter controls, local Subgraph copies and Chinese narrow headers. Both use the portable editor-state fixture. Windows Chromium is verified; physical touch devices and macOS remain unverified.

Live delivery uses `tools/dev/jobs/refresh_sources.py`, preserving Shader state and the connection session. Saving the formal development TOE is a separate step through `save_source_project.py`.
