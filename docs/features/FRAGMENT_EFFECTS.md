# Fragment effects and terminal nodes

2026-09-26, 0.8.239. The author requested Discard, custom depth output, independent TDDither and TDAlphaTest. Existing Pixel Output finishing stays unchanged. Repeated dithering or alpha tests are the graph author's responsibility; do not deduplicate, disable or block them. TDOutputSwizzle remains automatic. TDCheckDiscard, Picking and automatic material-input hints are outside this change.

| Node | Input | Output | Availability |
|---|---|---|---|
| Discard | `condition: bool`, default false | None | MAT/TOP Pixel |
| Depth Output | `depth: float`, unconnected uses `gl_FragCoord.z` | None | MAT Pixel |
| TDDither | `color: vec4` | `out: vec4` | MAT Pixel |
| TDAlphaTest | `alpha: float`, default 1 | None | MAT Pixel |

0.8.240 presentation clarification: Discard and TDAlphaTest use the same green Output family color as Depth Output to identify their terminal role. TDAlphaTest still returns no value; no alpha passthrough port is added. TDDither keeps the ordinary operation color. This changes presentation only, not node signatures or shader behavior.

0.8.242: MAT Color Output exposes three independent switches: **Dither**, **Alpha Test**, and **Output Color Space Conversion**. Newly added MAT nodes enable all three; the editor obtains these target-specific creation defaults from `type_contract().pixelBufferOutputs.finishingDefaults`. TOP has none of these switches and continues using Swizzle only. Node identity, revision and port signatures are unchanged.

Each switch controls only the automatic call on Buffer 0. Enabled operations run Dither → Alpha Test → color-space conversion → Swizzle. Alpha Test reads Buffer 0 alpha, but a failed test discards the entire fragment and prevents every color buffer from being written. Dither follows TD rendering settings; Alpha Test follows MAT enable, comparison and threshold. Extra buffers only use Swizzle. Empty primary buffers remain exactly zero (Dither and conversion are skipped), while the enabled Alpha Test still executes. Independent TDDither, TDAlphaTest and TDConvertColorSpace nodes are unaffected, including when all output switches are off; repetition is allowed and never detected or suppressed. Custom Discard and Depth Output are not automatically added.

Saved pre-switch nodes, including existing templates/examples, retain their original generated GLSL and effective settings: Dither and Alpha Test on; conversion follows legacy `nativeFinishing` (missing means off). Merely opening the inspector never changes the document. The first explicit switch edit materializes all three booleans (`dither`, `alphaTest`, `convertColorSpace`) from their effective values and removes `nativeFinishing`, as one normal Undo transaction. From then on the independent-switch order applies. Legacy code generation preserves the former order and exact shader text until edited. Low-level core node factories remain target-neutral; callers requesting new MAT defaults explicitly pass the finishing defaults rather than changing saved graph semantics. No catalog-revision migration is needed.

Help and tooltips in all five languages explain scope, native settings, whole-fragment alpha rejection and independent-node behavior. `test_output_finishing.py` checks all eight combinations, additional buffers, include dependencies, legacy compatibility, invalid values, independent/repeated calls, document preservation and source mapping. The browser test covers real node creation, Undo/Redo, legacy presentation/edit migration, readonly, serialized compilation, five locales and mobile/floating panels. The TD test compares all eight combinations against handwritten native GLSL, including alpha rejection and disabling MAT Alpha Test. Render TOP validation does not constitute a separate Window/viewer color-management test.

## Terminal behavior: refactor reference

The author explicitly confirmed that a node with no output sockets can still be an endpoint when tracing dependencies. Discard, Depth Output and TDAlphaTest are **terminal nodes**: placing one in a stage or inside a placed Subgraph makes it a compilation root, without requiring a wire to the color output. Follow every required upstream input and emit that chain even if no color result uses it. Ordinary disconnected value computations, including TDDither, remain pruned. A stored Subgraph definition that has no placed instance has no effects. Each placed instance contributes its own terminal nodes, even if that instance's value outputs are unused. A downstream If/Switch selecting a value does not conditionally execute these terminals; connect the condition to Discard itself or compute the desired depth/alpha upstream.

On the author's request for a clearer name, use **Terminal Node（終端節點）** in this record, replacing the initial “return label” suggestion. It means an endpoint for dependency traversal, not necessarily termination of execution: Discard ends the current fragment, Alpha Test conditionally discards it, and Depth Output writes a value and continues. It is not a GLSL `return`. The essential distinction is whether a node produces a value, has an observable effect, or is a compilation root; output-socket count alone cannot answer all three. General control-flow/effect sequencing and the final JS schema remain future work.

The current compiler traverses explicit Discard roots, then explicit Alpha Test roots, then Depth Output, then the regular color output. Each root's input dependencies execute before it; shared values execute once. Root order within one kind is stable by node identity, not screen position or JSON node order. This is a narrow, documented ordering contract for these nodes, not arbitrary graph control flow. Existing stages without these terminals retain their previous emission order. Source-map ownership includes the terminal statement and maps nested effects back to the Subgraph instance.

Only one Depth Output is accepted per expanded Pixel stage, including repeated/nested Subgraph instances. Multiple writers fail validation instead of choosing a result by node order. Use an If/Switch value upstream of one writer for conditional depth. Every surviving fragment reaches that writer; discarded fragments need not write depth. Default unconnected depth preserves rasterized depth. This avoids an undefined depth path without introducing a runtime enable switch.

## Native behavior and cautions

Discard emits `if (condition) { discard; }`. It affects the entire current fragment and all its color outputs. It is not `TDCheckDiscard()` and does not guarantee hardware early rejection or that unrelated work can never be scheduled by a GPU.

Depth Output writes `gl_FragDepth` directly. Its float is window-space depth (normally 0–1), not a world-space Z coordinate. Custom depth can disable early depth rejection and increase fragment-shading cost for the whole compiled shader, not just the runtime branch that writes it. The inspector and Help display this warning. MAT depth-test/write settings still apply; this is not a forced test pass or a replacement for MAT Common settings. No conservative-depth or forced-early-test declaration is generated.

TDDither calls the native function and returns its color. TDAlphaTest calls the native test with the supplied alpha; TD's Alpha Test enable/function/reference settings determine whether a fragment is discarded. Creating this node does not enable Alpha Test on the MAT. No custom thresholds or emulated TD functions are introduced.

References: [TD GLSL MAT](https://derivative.ca/UserGuide/Write_a_GLSL_MAT), [MAT Common](https://derivative.ca/UserGuide/MAT_Common_Page), [Khronos fragment outputs](https://wikis.khronos.org/opengl/Fragment_Shader/Defined_Outputs).

## Verification

`tests/unit/test_fragment_effects.py` has eight checks covering terminal dependency traversal, pruning, deterministic ordering, duplicate depth rejection, stage/target restrictions, repeated native calls, placed/unplaced Subgraph effects and existing-output preservation. `tests/td/test_fragment_effects.py` passes ten cases on TD 2025.32820, with zero pixel error against handwritten native shader expressions for eight MAT cases; additional checks exercise native Alpha Test enable/disable and two depth-occlusion orderings. Two TOP Discard cases match native discard and the configured clear color. `tests/browser/test_fragment_effects.cjs` passes seven checks for availability, ports, five-language depth warnings, Undo/Redo, clipboard, bool wiring and a narrow floating pane. Chromium only; iOS Safari is not tested.

Eight existing MAT/TOP demo and Phong/PBR preset compile results are identical to the pre-change version, including shader text, source maps and diagnostics. The broader 561-test Python run had 558 passes and three failures also reproduced unchanged on the prior commit (two historical output snapshots and one typed-Undo fixture missing `Par.style`); it is not reported as an all-green suite. The two subsequently added terminal/Subgraph checks pass in the focused suite.
