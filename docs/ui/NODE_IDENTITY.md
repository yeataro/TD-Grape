# TD-Grape node names and comments

## Node identity presentation — 2026-09-11

Functional names remain the primary title; the optional instance Label is right-aligned on the same line. Duplicate header type badges are removed, with types retained on individual ports. A Subgraph uses the three-circle connected SVG before its shared definition name. The SVG asset is canonical; tools/build/sync_subgraph_icon.py embeds it without a new HTTP route.

Parameter exposes separate Label and collapsible Comment fields. Comments are plain text stored in ui.comment, also visible in Help. They preserve Undo/Redo, graph clipboard and read-only behavior; unsafe markup remains inert. Presentation-only edits do not localize a source function or change shader behavior. GLSL comment emission and Expose-name synchronization are not introduced by this change.

Validation: 9 Chromium identity/comment checks, 14 tree-browser regression checks, 328 bilingual locale references, and six MAT/TOP example compilation results unchanged by Label/Comment decorations. Current live graphs and GLSL are preserved by the scoped asset refresh.

## Parameter title and canvas notes — 2026-09-11

The user prioritized this specific implementation while the broader layout, input-definition and taxonomy discussions remain pending. The selected-node Parameter page now starts with the node-family color and functional/definition name on the left, plus an editable instance Label on the right. Node parameters and settings follow; the collapsible Comment editor is last on either tab. The existing Shader-wide Exposed page remains separate. Diagnostic node IDs remain available under Settings.

Nodes with a nonempty Comment show a collapsible footer below their ports, values, color swatch and Exposed badge. The text uses the node's existing color family with subdued contrast. Empty comments add no footer. Notes are plain text; HTML-looking content is not interpreted. Footers start expanded, and folding is view state remembered across redraws in the current browser session, not a saved Shader edit or undo entry.

This does not change Subgraph definitions, source localization, GLSL emission, Expose bindings, shader identifiers or the unresolved canvas-title metadata arrangement. Instance Labels still use the existing undoable presentation edit, and function-definition renaming remains a separate operation.

Validation: 9 existing Chromium identity/comment checks and 5 focused browser checks passed. Coverage includes matching title colors for Sampler/Uniform/Subgraph/Output, comment placement on both tabs, plain-text display, folding without graph/history/selection changes, keyboard folding, redraw persistence, Label cancellation, Exposed scope, bilingual narrow layouts and read-only fields. Syntax checks pass. This is not physical iPad/Safari validation.

Deployment is limited to inspector.js, graph_ui.js and style.css read explicitly from the canonical TD-Grape source directory through the existing legacy development bridge. The deployment verifies native graph/state/GLSL, catalog/library fingerprints and port identity before/after, with rollback of the three UI DATs if verification fails. It does not migrate or save the running TOE, restart its server, modify the private remote helper, or mirror new source files into the legacy src directory.
