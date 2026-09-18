# TD array sources and host structure references

This document describes the array source integration in the current development implementation. It complements [the array and structure plan](../discussions/ARRAY_AND_STRUCT_PLAN.md) and [the TOP source inventory](TOP_SOURCE_INVENTORY.md). Implementation and isolated validation do not, by themselves, mean the installed TD manager or saved TOE has been updated; delivery is recorded separately in development status.

## Type ownership and source ownership

An array port describes its element type and length. A source describes where its values come from. These are separate responsibilities:

- A graph-created `vec3[8]` is ordinary shader data. Array creates deterministic zero values; Array Replace produces a separate modified result. It does not write back to TD.
- A CHOP-backed Uniform Array is declared in GLSL by Grape, while TD owns its live values and native parameter modes.
- A built-in TD array is already declared by TD. Grape describes its type and fields and emits references, not duplicate declarations or uploads.
- Samplers and buffers are resources with additional capabilities and restrictions; an array-looking interface does not make them ordinary copyable values.

`Array[i]` clamps a signed index to `0..N-1`, or caps an unsigned index at `N-1`. Array Replace changes an element only when its index is in range; otherwise its output retains the original contents. Fixed lengths and TD length macros are compile-time bounds. No operation scans an array to count its elements.

## Native CHOP Uniform Arrays

Both GLSL TOP and GLSL MAT use the native Arrays sequence. The implementation owns the source identity and configuration without becoming a second store of sampled CHOP values.

| Native parameter | Meaning |
| --- | --- |
| `arrayNname` | GLSL Uniform name |
| `arrayNtype` | Native element carrier: `float`, `vec2`, `vec3`, or `vec4` |
| `arrayNchop` | CHOP source path or native expression / binding |
| `arrayNarraytype` | `uniformarray` for this integration; `texturebuffer` is a different resource |

Channels supply components and samples supply elements. The native carrier supports the four float/vector types above. This is a restriction of this TD source path, not a restriction of graph-created arrays: graph arrays may contain other supported numeric types, matrices, and structures.

An example declaration is:

```json
{
  "id": "weights",
  "kind": "uniform",
  "name": "uWeights",
  "type": "vec3[8]",
  "nativeSequence": "array",
  "arraySource": "../weights_chop",
  "value": null
}
```

`arraySource` is the portable initial binding. Once instantiated, the native OP parameter owns the active binding, including its Expression, Bind, or Export mode. `value: null` means the values are supplied by that binding; it does not initialize the CHOP or upload zeros. Older explicit array default lists remain readable, but they are not a competing live value store.

### Fixed length and changes

- The graph declaration has a fixed positive length. The current general array model accepts lengths from 1 through 1024; the GPU's Uniform storage budget can impose a lower practical limit across declarations.
- Creating, rebinding, or applying a source verifies that the CHOP exists and has at least the declared number of samples. More samples do not automatically increase the graph type's length.
- An unregistered native Uniform Array can be imported. Its native element menu and CHOP sample count establish the initial graph type once. No sample contents are copied into the declaration.
- Later CHOP value or sample-count changes do not silently rewrite the declared type or create graph history entries. The shader array's declared length and the application's meaningful-data count remain distinct.
- If a source changes to a different native element type or to Texture Buffer storage, its existing graph declaration is diagnosed as mismatched rather than silently reinterpreted.
- Live changes after validation remain TD's responsibility. In particular, a later shrinking or missing CHOP does not turn the declared Uniform capacity into a new graph length. The next explicit source edit or Apply checks the binding again.

### Configuration, history, and candidate validation

Source snapshots return `components: []` and an `arrayBinding` record: parameter identity, mode, stored path, expression or binding text, element type, carrier type, declared length, writability, and a conflict token. They do not evaluate the CHOP expression or read its samples just to refresh the UI.

CHOP lookup and length inspection happen on import, binding edits, and Apply. Binding edits reject stale tokens and preserve Bind / Export ownership. Invalid edits restore the previous parameter configuration. Source history captures configuration, so animated sample values do not continually invalidate Undo / Redo.

Candidate validation resolves a binding in the original Shader's context. Relative paths and expressions keep their original meaning; an existing source is not redirected to the temporary candidate COMP. An unsuccessful candidate preserves the saved graph and last successfully applied shader.

The existing request/response source editing path remains in use. This change does not introduce a WebSocket transport, a Python per-frame sample mirror, or Uniform synchronization UI refactoring. Uniform Arrays also do not expand into hundreds of generated COMP numeric controls; their live data is edited at the CHOP source.

## Registered built-in sources

| Source | Graph type | Environment |
| --- | --- | --- |
| `sTD2DInputs` | `sampler2D[TD_NUM_2D_INPUTS]` | TOP Pixel |
| `uTD2DInfos` | `TDTexInfo[TD_NUM_2D_INPUTS]` | TOP Pixel |
| `uTDMats` | `TDMatrix[TD_NUM_CAMERAS]` | MAT Vertex and Pixel |
| `uTDCamInfos` | `TDCameraInfo[TD_NUM_CAMERAS]` | MAT Vertex and Pixel |
| `uTDLights` | `TDLight[TD_NUM_LIGHTS]` | MAT Vertex and Pixel |

The existing TOP Input node remains a convenient per-source reference. Whole-array references do not allocate extra textures. The current managed TOP inventory still accepts 2D sources only; this does not claim support for importing 3D, Cube, or 2D Array textures into that inventory.

The type registry declares no copies of these host structs. Field selection uses stable field identities and the registered GLSL member names. The field order below also matters when constructing a value of a host structure type.

### TDTexInfo

| Field, in order | Type |
| --- | --- |
| `res` | `vec4` |
| `depth` | `vec4` |

`res` contains inverse width, inverse height, width, and height. Source length is shared with `sTD2DInputs`, so the same index refers to the matching texture and its metadata.

### TDMatrix

| Fields, in declaration order | Type |
| --- | --- |
| `world`, `worldInverse`, `worldCam`, `worldCamInverse` | `mat4` |
| `cam`, `camInverse`, `camProj`, `camProjInverse` | `mat4` |
| `proj`, `projInverse`, `worldCamProj`, `worldCamProjInverse` | `mat4` |
| `quadReproject` | `mat4` |
| `worldForNormals`, `camForNormals`, `worldCamForNormals` | `mat3` |
| `clipDistances` | `vec4` |

### TDCameraInfo

| Field, in order | Type |
| --- | --- |
| `nearFar` | `vec4` |
| `fog` | `vec4` |
| `fogColor` | `vec4` |
| `renderTOPCameraIndex` | `int` |
| `ipdShift` | `float` |

### TDLight

| Field, in order | Type |
| --- | --- |
| `position` | `vec4` |
| `direction` | `vec3` |
| `diffuse` | `vec3` |
| `nearFar` | `vec4` |
| `lightSize` | `vec4` |
| `misc` | `vec4` |
| `coneLookupScaleBias` | `vec4` |
| `attenScaleBiasRoll` | `vec4` |
| `shadowMapMatrix` | `mat4` |
| `shadowMapCamMatrix` | `mat4` |
| `shadowMapRes` | `vec4` |
| `projMapMatrix` | `mat4` |

The native **2025.32820** schema contains three members not listed in the inspected public guide: `TDMatrix.quadReproject`, `TDMatrix.clipDistances`, and `TDCameraInfo.ipdShift`. Constructor probes exposed this difference. The registry records the actual host schema, including field order, instead of assuming the guide is an exhaustive ABI definition. Referencing known fields and constructing a complete structure impose different completeness requirements. Other TD builds must be verified before claiming the same host structure layout.

### Empty sources and validation context

An empty built-in source cannot be read. The generated shader diagnoses zero host elements instead of generating `clamp(i, 0, -1)` or inventing a sampler value. A zero-input TOP candidate is rejected while preserving the graph and last valid program.

MAT's isolated validation scene supplies one temporary light when the candidate references the host light array. It validates the array's schema in a representative render context, then restores the test Render's light configuration and destroys the temporary light. User Render TOPs and scene lights are not changed. This validation is not a guarantee that every real Render context has lights: if the real context has zero lights, the shader's host-count diagnostic applies there.

## Resource boundaries

`sTD2DInputs` can be indexed and its resulting sampler can be passed into supported sampling operations. It is not constructed as a local sampler variable, zero-filled, copied as mutable numeric data, or accepted by Array Replace. A non-uniform sampler index uses the corresponding GLSL resource-indexing qualifier; clamping alone does not satisfy resource indexing rules.

These native resource paths are inventoried but are not represented as ordinary fixed value arrays in this implementation:

| Resource | Native access and boundary |
| --- | --- |
| CHOP Texture Buffer | `samplerBuffer` with `texelFetch`; it needs buffer read/length capabilities, not ordinary Uniform Array copying |
| Runtime-sized SSBO array | Runtime length depends on bound storage; mutability, layout, synchronization, and function transport require explicit capabilities |
| TOP / MAT POP attribute buffer | TD-generated `TDBuffer_…` accessors and associated length metadata; no automatic writable array view |
| TD environment-light buffers | Host storage-buffer-backed resource; not interchangeable with a normal struct array |
| Additional TD structure sources | Must be registered with exact field identity, provider, target, and Stage availability, then verified against the native build |

## Verification and known host observation

Validated on TouchDesigner **2025.32820**:

- `tests/td/test_array_nodes.py`: 277 GPU records passed for signed and unsigned indexed access, fixed length, zero numeric/vector/matrix arrays, Replace's unchanged out-of-range result and independent original branch, generated structure field access, all four CHOP array carriers, and built-in references. All 34 registered MAT structure fields were compared with their native host values in both Vertex and Pixel stages; TOP sampler and texture-info indexing were checked as well. Host-structure zero construction includes the three additional fields described above.
- `tests/td/test_array_sources.py`: eight source integration checks passed for TOP / MAT creation and import, configuration Undo / Redo, relative binding preservation during candidate validation, animated data staying outside history, empty TOP-source rejection, and isolated MAT light validation.
- Both fixtures verified that user shader contents and the original manager registry/selection were preserved, and removed their disposable areas.
- A final rerun of the source fixture after the temporary MAT light cleanup change received no response from the development bridge. TD was unresponsive after the 277-record GPU job had reported success; the cause was not established. The unacknowledged request was deferred to prevent automatic execution on recovery. The earlier eight checks are evidence for the earlier fixture/runtime revision, not a completed final rerun or live delivery.
- `tests/unit/test_array_sources.py` covers carrier validation, null defaults, no-sample snapshots, import limits, stale bindings, read-only modes, short sources, configuration rollback, and original-context path resolution. Existing numeric/matrix source and history tests also pass.

A separate test observation must not be confused with array indexing: on this TD build, a dynamic `uint` Uniform delivered through the GLSL TOP Vectors page did not preserve the intended `4294967295` value in the probe, while MAT passed the same case. The precise host conversion path was not established. No new graph type restriction or Uniform coercion was introduced. Array unsigned-boundary behavior is verified using the exact GLSL literal `4294967295u`; dynamic clamp behavior is independently verified using smaller out-of-range Uniform values that the native carrier preserves. Uniform transport precision remains a separate topic.

## References

- [GLSL TOP Arrays parameters](https://derivative.ca/UserGuide/GLSL_TOP#Parameters_-_Arrays_Page)
- [TOP built-in Uniforms and samplers](https://derivative.ca/UserGuide/Write_a_GLSL_TOP)
- [MAT built-in Uniforms and structure definitions](https://derivative.ca/UserGuide/Write_a_GLSL_MAT)
- [Script CHOP array layout](https://derivative.ca/UserGuide/ScriptCHOP_Class)
