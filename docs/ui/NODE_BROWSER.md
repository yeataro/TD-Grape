# TD-Grape Node Browser

Implemented from the cloud task “Node Browser Taxonomy Design” (2026-09-10), then aligned to the two user-supplied mockup screenshots. The cloud HTML attachment itself was not retrieved. Categories, Library and This Project are vertically stacked accordion sections, not horizontal entry tabs.

## Browsing and searching

Categories / Library / This Project share one search field. Search crosses all three views and all functional categories; the explicit Source selector still applies. Results rank exact name/GLSL name, aliases, name fragments, category/tags, then localized descriptions. No dependency-derived tags and no duplicated definitions from secondary categories.

The functional categories are Math, Vector, Matrix, Logic, Color, Coordinate, Texture, Data, Shader, plus Uncategorized for user definitions with no assigned metadata. Only categories with actually available entries appear. Matrix and Logic therefore do not appear before supported nodes exist. Stage constraints and the existing concrete-type/Auto connection planner remain authoritative.

Library shows built-in and Personal assets, using the same definitions as Categories. This Project shows reusable definitions and saved source versions in the current Shader, with an explicit scope explanation; it does not invent cross-Shader editing. Handwritten GLSL Functions and Pack installation are not available yet and are not displayed as placeholder capabilities. Whole-Shader examples remain a distinct collapsible Library section.

Select a row to inspect its ports and Markdown Help. Use +, double-click or drag to insert. Repeated library insertion retains existing reference reuse. Personal refresh/location/save drop target and current declaration controls remain available. The floating creator shares the same categories, source identities and ranked search, with the existing compatible-wire filtering and Auto behavior.

Colors are restrained: small SVG icons carry functional category accents, with source text identifying provenance. Socket colors remain unchanged. Palette colors are centralized in CSS. All new text is in locales.json.

## Metadata and compatibility

Authored browser metadata lives beside each node definition in node_catalog.json, outside its semantic revision fingerprint. Built-in library metadata is an opt-in display projection produced by function_library(with_browser=True); the default snapshots are byte-for-byte unchanged. tools/sync_node_browser.py generates the embedded browser index in index.html. Its --check mode detects stale projections. No second handwritten node index, new server route or external dependency is introduced.

## Validation

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
