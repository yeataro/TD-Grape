# TOP source inventory — 0.8.79

This development version replaces the parallel TOP Input / independent Sampler paths with one ordered source inventory. MAT continues using its native sampler declarations. This is not an Alpha release.

## User behavior

- **Inputs → TOP Input → Create source** adds one explicit 2D source and one COMP input, up to 16. The name is the actual GLSL reference `sTD2DInputs[i]`; an optional Label describes its purpose.
- The inventory’s `+`, generic TOP Input node, node duplication, and same-Shader clipboard copies create references. They do not allocate another image. Generic TOP Input chooses the selected source, otherwise the first; with an empty inventory it asks the user to create a source first.
- A reference node’s Parameter page selects its source from the inventory and links to that source’s editor. Source defaults, ordering, exposure and deletion live in the source editor.
- Source order determines COMP connector order, TOPs order, and the 2D array index. Stable IDs preserve references and external wires when rows move. Labels do not control identity or order.
- Remove graph references and disconnect the matching COMP wire before deleting a source. The last source can be deleted. Unconnected ordinary texture sampling returns opaque black without allocating a hidden input; custom GLSL sampler arguments require an actual resource.
- The default template starts with one banana source and explicit TOP Input → Texture 2D sampling. External wiring overrides that source’s default.
- Time and Frame shortcuts reuse a Uniform carrying that preset identity. They do not overwrite its current value or TD driver. Explicit ordinary Uniform creation remains independent.

## Native structure

A typical row is `input_1_default` (Movie File In or Constant) → `in1`; the shader’s TOPs parameter lists `in1 in2 …`. A Select is added only for a path/public-parameter override. Exposed sources can have an explicit black fallback for a missing path. No input router, repeated per-reference selectors, or unconditional extra banana is needed.

New/reordered source rows use 220 network units of vertical spacing. Existing positions are retained during ordinary applies when the inventory order is unchanged. A one-time migration arranges the owned shader, output, code and support nodes in separate areas. Unknown OPs remain untouched; collisions with generated source names fail instead of replacing user content.

The serialized `topInputs` array is authoritative. TD storage contains derived resolved bindings. `legacyKeys` reconnect existing public TOP parameters during migration; they do not represent additional sources. Retired native resources are identified from the previous resource registry and removed only after a successful deployment. Compatibility code remains for old documents and transaction rollback.

## Output resolution and dimensionality

Native TD 2025.32820 probe: GLSL TOP Common `Use Input` follows a physical wire, but with only TOPs populated it retains the configured resolution. Grape therefore explicitly reads the first managed In TOP’s dimensions when Match Input is selected. With zero sources, Width/Height become the fallback and remain editable.

This implementation supports **2D only**. The compiler checks the 2D input count so a 3D input cannot silently shift the indices. Probes confirmed native mixed dimensions are grouped separately and unplugging a 3D external input returns to the default’s dimension. Declared 3D/Array/Cube sources and typed defaults remain future work. Plain GLSL TOP accepted five TOPs inputs in this build; no change to GLSL Multi TOP is required for this implementation.

## Migration

`topSourceVersion: 1` records the model revision separately from the product version and node catalog ABI. Old TOP documents require the normal review/backup path. Existing Sampler declarations become inventory entries, Input 0 aliases share their existing slot, and legacy combined Texture nodes become explicit source plus sample nodes while retaining their UV/output wiring and sample-node identity. Switching away from `input:0` with a leftover `defaultSource` field is repaired by using the selected independent source. Referenced external function definitions are localized when migration changes them.

Baseline Git commit: `1a88f46`. Masters and the live `/project1/Grape_TOP1` were upgraded with backup and candidate validation. Native OP/public parameter identities were checked. The old browser tab held a different Shader identity and an eight-node graph: its original JSON and upgraded JSON were separately preserved under the private `work/reports/top-sources-0879/browser-backup/` report, without replacing the live TD graph.

## Verification

- Portable regression suite: Python compiler/document/runtime tests, locale checks, editor launch and metadata checks, icon checks, and JavaScript models/preview controls.
- New compiler cases: explicit migration, stale source-mode metadata, repeat references, zero inputs, no hidden fallback allocation, MAT isolation.
- New clipboard case: repeated references within a Shader and repeated imports from the same source Shader reuse the inventory entry.
- Native TD tests: five inputs, eight repeated references without additional OPs, reordering with an external connection, first-input resolution, and zero-input dimensions.
- Native transaction tests: injected upgrade failure and zero-input failure restore previous graph/output; exposed TOP parameter identity and Python expression survive; MAT still compiles through its sampler model.
- Browser UI: source creation/removal, native index name, reference dropdown, time shortcut reuse, successful automatic apply, and no console errors in the test page.

The complete Inputs visual redesign, unconnected-socket shortcuts on all source/output categories, and multi-dimensional input UX remain outside this round.
