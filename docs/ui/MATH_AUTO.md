# Math Auto type policy

New polymorphic Math nodes created in the sidebar, canvas/Tab creator or drag-to-create default to Auto. This covers the 17 existing Math definitions with a parameter-selected signature; fixed Compose/Split nodes retain their defined ports. Operation Type in Parameter offers Auto and each supported explicit type. An explicit type filter in Create is treated as a deliberate manual lock. Existing nodes without the new policy metadata remain locked to their stored type; opening, rendering, moving, labeling and value-only editing do not migrate old graphs.

Auto chooses the legal signature with the fewest input conversions, then the smallest dimension. With no connected input it resolves to float. Inference follows upstream outputs; downstream inputs never pull an upstream node into a wider type. Float + vec4 resolves to vec4 using the existing explicit scalar splat, while two floats resolve to float. Length/Dot still report float output when their operation type is a vector. Different vector dimensions are not silently resized.

The planner consumes the same versioned type contract as ports/Create/compiler. Direct connection, reversed drag, drag-to-create, connection highlighting and edit commits all use it. Any new incompatible edge, including an existing locked downstream made invalid by inference, rejects the whole edit. No wire is silently removed. Successful inference and connections use one Undo step. Existing invalid drafts can still receive edits that do not introduce a new type conflict.

Saved params.type always contains a concrete GLSL type; ui.typeMode records auto/locked editing policy. No new catalog revision, compiler emitter, graph schema or migration is needed. Read-only library graphs retain their stored concrete types until localized for editing. Typed Graph Function boundaries determine their inputs/outputs independently of the visible graph. Clipboard/duplication retain Auto metadata.

Manually entered input defaults are retained per concrete dimension in ui.inputValuesByType. On the first transition a missing shape uses the existing scalar/component shaping rule; returning to a previously edited dimension restores those values. Connected inputs retain dormant defaults. Mode/cache metadata does not alter generated GLSL, bindings or semantic hash for an otherwise identical concrete graph.

## Validation

- 20 pure model checks: legacy behavior, widening/narrowing, forward chains, actual scalar outputs, conflicts, locks, cached defaults, cycles, Function boundaries and read-only snapshots.
- 14 interactive browser checks: palette default, Parameter control, conversions, Undo/Redo, rollback, both drag directions, explicit Create filters, clipboard/duplicate, real pointer highlighting and localization.
- 30 focused regression checks: existing Create palette (10), Clipboard (12), Function renaming (8).
- 10 compiler comparisons: Auto metadata removed from an identical concrete graph produces the same vertex/pixel GLSL, bindings and semantic hash.
- 10 actual TD GLSL TOP cases, 32×24 RGBA32F, checked across every pixel. Mixed vectors/scalars, chained Auto, Length, manual splats, defaults, Function boundaries and scalar Dot/Length/Normalize all matched expected values, max error below 9e-8. Temporary test components were removed; live Shader state/graph/manifest/GLSL and server/port stayed unchanged.

Maintained tests: tests/browser/test_math_auto_model.cjs and tests/browser/test_math_auto_browser.cjs accept SOURCE_DIR STATE_JSON REPORT_DIR [OVERLAY_DIR]. The model writes compiler-cases.json; tests/integration/test_math_auto_compiler.py accepts SOURCE_DIR CASES_JSON REPORT_JSON. Use an isolated fixture, never replace a user's live Shader with the test graph. Browser checks use Chromium and do not establish actual iPad wire alignment.
