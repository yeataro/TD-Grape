# Legacy TOP/MAT completion

This work extends the existing TD-Grape architecture for its final archival edition. It does not implement the next project's proposed node-definition architecture.

## 0.8.164 checkpoint

The catalog contains 293 definitions: the original 88 plus 204 function/material entries and one shared Vertex Inputs boundary. Existing definitions retain their identities and behavior.

- Native GLSL calls include numerical, vector comparison, boolean, bit conversion/packing, integer, derivative and texture operations. Calls with output arguments execute once and expose each result separately.
- TD calls include matrix transforms, noise derivatives, color transforms, geometry/instance transforms, sampling, mapping, shadows and lighting. Availability follows compilation on TD **2025.32820**, not merely presence in the current online documentation.
- Phong Material and PBR Material traverse TD lights automatically. PBR also traverses environment lights. Position, normal and camera default to the rendered geometry; custom vertex displacement requires matching world-space overrides. These use TD's lighting model, not an exact Blender Principled implementation.
- Vertex Index is available as a MAT vertex source. Position, normal, point color and texture coordinates retain their existing sources, with additional search aliases.
- Connect to the Vertex Outputs or Vertex Inputs spare port to add a shared interface. Names, types, order and interpolation are editable. Removing an interface port removes both endpoints' associated connections in one undoable edit.
- Stage payloads support scalar/vector/matrix values, fixed-size arrays and value structures. Boolean values travel as integer varyings. Integer, boolean and double components use flat interpolation. Resources cannot be stage varyings. Symbolic array extents are not supported here. Up to 16 payload ports and 1024 flattened leaves are accepted; actual GPU varying capacity may be lower and is checked by TD.
- Native MAT Attribute creation, editing, import, removal and explicit format adoption retain their established behavior. Scalar/vector and matrix attributes were exercised against the native MAT. Other-vertex lookup remains a later item.
- Built-in Source Help now follows the selected source rather than showing only the generic node description. New functions have signature and official reference links. A complete semantic Help audit remains separate from signature coverage.

## Verification

`tests/unit/test_legacy_mat_completion.py` covers stage payload transport, invalid payload rejection, lighting defaults, source mapping and single evaluation of output-argument calls. The portable suite passes, including the original 138 graph fingerprints.

`tests/browser/test_vertex_lighting.cjs` exercises real spare-port dragging, paired interfaces, Undo/Redo, removal and lighting controls. `tests/td/test_vertex_lighting.py` compiles the materials and scalar, integer, boolean-vector, matrix, array and structure payloads through an actual MAT. `tests/td/test_mat_attributes.py` verifies native attribute lifecycle and preservation of existing shaders.

`tests/td/test_legacy_function_signatures.py` checks native calls in small isolated batches. Current entries passed all 1,471 supported context/signature combinations: 532 MAT pixel, 454 MAT vertex and 485 TOP pixel. This is compilation coverage, not numerical validation of every function or cross-platform validation. Tests leave existing shader graphs unchanged.

An earlier test shader omitted a varying expected by its companion stage. Repeated fixture failures caused an excessively long test and TD was restarted. The fixture was corrected, jobs limited to 12 signatures, and stale work parked rather than automatically replayed.

## Host and archive limits

These documented TD functions are absent in the tested build and are not exposed as working nodes: `TDExtractRotation`, `TDSlerpRotationMatrices`, `TDInterpolateTransformMatrices`, `TDAxisAngleToQuaternion`, `TDQuaternionToRotMatrix`, `TDRotMatrixToQuaternion`, `TDRotateFromQuaternion`, `TDQuaternionMultiply`, `TDSlerpQuaternions`, `TDQuaternionFromTo`.

TD transfer/gamut calls compile only in MAT pixel on this build; their nodes are restricted accordingly. New sampling functions require an explicitly connected compatible resource. Existing fallback behavior on older nodes is unchanged. A valid native sampler signature does not by itself add a native texture-binding configuration for that dimension.

Compute, image writes, Picking and other new execution flows remain outside this archive's TOP/MAT scope. macOS has not been verified.

## Remaining completion work

### 0.8.166 additions

The catalog now has 328 definitions. Added component-factor mix, scalar-edge step, scalar boolean operations, integer bitwise/shift/remainder operators, texture offsets and projected LOD/gradient sampling. Ordinary constant offset requirements are checked before GLSL compilation. Native coverage is now 1,753 context/signature combinations (626 MAT pixel, 548 MAT vertex, 579 TOP pixel).

All 55 built-in source choices now carry individual bilingual Help and an official reference. Standard function Help describes operation semantics and required constant operands. Single-light TD calls explicitly point to Phong/PBR Material for automatic traversal; integrated materials are searchable by lighting/material terms.

Vertex interface type checks now use their supplied graph snapshot, so previous/candidate graphs do not accidentally read the live interface. Browser coverage includes a second port added after visiting Pixel. The reported missing-port screenshot has matching `out: vec3` ports at both ends; whether the report refers to the special `position` output or a different new port remains unconfirmed.

Both integrated materials were rendered with zero, one and two regular lights. Pixels are finite, no lights give black, and red/green lights contribute independently. This does not yet establish full equivalence with the native Phong/PBR MAT.

The author additionally requested ready-to-test graphs and scenes corresponding to the basic native Phong MAT and PBR MAT capabilities. That is the next deliverable; isolated signature tests alone do not satisfy it.

- Audit remaining GLSL overload/operation forms against the available resource types.
- Finish selected-source and function Help descriptions and chapter coverage.
- Reconcile older gap notes with the delivered catalog; keep actual binding and host limitations explicit.
- Other-vertex Attribute lookup follows the basic MAT work, as requested.

The 0.8.163 gap counts in `docs/discussions/TD_FUNCTION_NODE_GAPS.md` are historical inventory, not the current number of missing nodes.
