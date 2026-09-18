# TD-Grape Node Browser

Implemented from the cloud task “Node Browser Taxonomy Design” (2026-09-10), then aligned to the two user-supplied mockup screenshots. The cloud HTML attachment itself was not retrieved. Categories, Library and This Project are vertically stacked accordion sections, not horizontal entry tabs.

## Browsing and searching

Categories / Library / This Project share one search field. Search crosses all three views and all functional categories; the explicit Source selector still applies. Results rank exact name/GLSL name, aliases, name fragments, category/tags, then localized descriptions. No dependency-derived tags and no duplicated definitions from secondary categories.

The functional categories are Math, Vector, Matrix, Logic, Color, Coordinate, Texture, Data, Shader, plus Uncategorized for user definitions with no assigned metadata. Only categories with actually available entries appear. Matrix and Logic therefore do not appear before supported nodes exist. Stage constraints and the existing concrete-type/Auto connection planner remain authoritative.

Library shows built-in and Personal assets, using the same definitions as Categories. This Project shows reusable definitions and saved source versions in the current Shader, with an explicit scope explanation; it does not invent cross-Shader editing. Handwritten GLSL Functions and Pack installation are not available yet and are not displayed as placeholder capabilities. Whole-Shader examples remain a distinct collapsible Library section.

Select a row to inspect its ports and Markdown Help. Use +, double-click or drag to insert. The whole name row supports mouse dragging; touch dragging uses the explicit + handle so the name rows remain scrollable. Repeated library insertion retains existing reference reuse. The floating creator shares the same categories, source identities and ranked search, with the existing compatible-wire filtering and Auto behavior.

Add Node and Inputs deliberately use different list presentations. Add Node keeps neutral row backgrounds, a small cube icon for ordinary nodes and a filled identity icon for Subgraphs. The Subgraph drawing has tighter bounds so both icons have a comparable visual size. Floating Add also uses neutral backgrounds, retaining its existing category accents rather than filling the row with the node category color. Source text still identifies provenance. Inputs keeps its rounded, softly tinted source rows; its category headings match the size, weight and brightness of Add Node category headings. Both panel titles use the shared workspace heading style; the English title is `Add Node`, matching `Inputs` capitalization. Row styling remains independent of source identities, search, insertion and socket colors.

Personal retains a compact, labelled Subgraph save drop target, Refresh Personal and the expandable source folder/load status. The lengthy instructions moved to Help, reachable through the small help button beside Personal. Loading issues remain visible in the expandable status. The drop target is not removed along with the old explanatory space.

## Metadata and compatibility

Authored browser metadata lives beside each node definition in node_catalog.json, outside its semantic revision fingerprint. Built-in library metadata is an opt-in display projection produced by function_library(with_browser=True); the default snapshots are byte-for-byte unchanged. tools/sync_node_browser.py generates the embedded browser index in index.html. Its --check mode detects stale projections. No second handwritten node index, new server route or external dependency is introduced.

## Initial implementation validation

- 18 real Chromium browser checks: global search/aliases/sources, definition reuse, both creation directions, drag/drop, read-only inspection, bilingual text and narrow layouts.
- 12 clipboard and 8 Function rename browser regression checks passed using their original fixture.
- 31 definition fingerprints, four default library snapshots, catalog contract and six MAT/TOP example compilation results match the baseline exactly.
- 326 locale references checked in both languages.
- The old test_editor_edits.js and test_types_ui.js VM fixtures already fail against the pre-change baseline after earlier Auto changes. They are recorded as an existing test-harness gap, not counted as passes. This change uses actual browser gesture/transaction regression checks instead.
- Chromium touch/viewport emulation is not physical iPad/Safari validation; the reported iPad wire offset remains open.

Live deployment records are in the local work/node_browser batch. It checks current graphs/revisions/GLSL and service port and does not replace graph data or touch the private remote helper. No old release package is resealed.

## Screenshot-aligned browser correction — 2026-09-10

The user supplied the two cloud mockup screenshots after reviewing the first implementation. The left Node Browser now uses vertically stacked Categories / Library / This Project accordions, rather than horizontal entry tabs. Categories contains a functional tree with indented guide lines and nested Math branches (Arithmetic, Interpolation, Range, Trigonometry, Exponential). Search stays above the scrolling list; selected-item help, category path, one supported signature and aliases stay in an independently scrolling bottom area. Rows are compact with a small category-accented SVG and right-aligned provenance.

Global ranked search, Source filtering, repeated Library reference reuse, Personal refresh/drop target, current-Shader scope and the floating wire-to-create planner retain their established behavior. Empty category families are not presented as available nodes. Tree expansion is presentation state; categoryPath metadata is outside semantic revisions. Pending Texture/Sampler/Expose decisions are untouched.

Validation: 14 actual Chromium tree/search/creation checks, 12 clipboard checks, 8 Function rename checks, both locales, unchanged catalog fingerprints/library snapshots and six MAT/TOP example compilation results. This is not physical iPad/Safari validation. The pre-existing VM fixture failures documented in NODE_BROWSER.md remain a separate harness gap.

## Wire creator: local matching and final validation — 2026-09-18

Floating Add opened from a wire searches the same browser index as standalone Add. Search, signature matching and validation execute in the browser; typing does not request a TD/server search or compatibility table.

Candidate previews match the selected socket against a small local signature graph using the existing type contract and Auto solver. Forward creation uses the existing source signature and the candidate. Reverse creation uses the candidate output type, the receiving node and its other input signatures. Ordinary equivalent Auto variants share a result; dimension-dependent Combine/Replace variants and explicit type filters remain distinct. Search text changes reuse results for that creator session. A complete graph/declaration/function/library/type-contract/stage/wire snapshot invalidates the cache when its context changes; closing the creator drops it.

The preview deliberately does not validate the entire downstream graph or propagate constants for every result. A locally compatible item can therefore appear even when a downstream or constant-only constraint will reject it after selection. This is a candidate-list difference, not permission to create an invalid graph: actual creation still uses the existing full connection validation inside the atomic edit transaction. Rejection restores the graph and does not add Undo history. Search ranking, explicit conversions, automatic casts and the graph format are unchanged.

The performance requirement covers opening the creator and successive keystrokes in both directions. Regression checks must also cover fresh validation after edits, rejected creation, explicit type filters, assembly sockets and candidate parity on ordinary valid graphs. Timing evidence and delivery status are recorded in [TESTING.md](../development/TESTING.md).
