# Texture offset sampling

Added in 0.8.224 after the [node-name audit](../discussions/NODE_NAME_AUDIT_2026-09-24.md). These are sampling operations using existing resources; they do not create new texture bindings or implement a blur filter by themselves.

| Function | Sampler variants | Extra operands |
| --- | --- | --- |
| textureGatherOffset | 2D, 2D Array | offset: ivec2, component: int |
| textureGatherOffsets | 2D, 2D Array | offsets: ivec2[4], component: int |
| textureProjOffset | 1D, 2D, 3D | offset: int / ivec2 / ivec3 |
| textureProjLodOffset | 1D, 2D, 3D | lod: float, offset |
| textureProjGradOffset | 1D, 2D, 3D | dx / dy: float / vec2 / vec3, offset |

All 13 entries return vec4 and appear under the existing Texture dimension categories. Search by the GLSL function name. English, Traditional Chinese, Japanese, French and Korean Help include the exact signature and restrictions.

## Inputs and restrictions

- Gather reads four values of the selected component (0–3), rather than returning one RGBA texel. A single Gather offset may be dynamic. Its component must be an ordinary compile-time constant.
- GatherOffsets requires exactly four ivec2 offsets as an ordinary constant array. Use a Graph Constant of type ivec2[4], or an Array node with element type ivec2 and length 4 whose elements are all constant. For example: (-1,0), (0,1), (1,0), (0,-1). Each offset selects one gather texel; this is not four full RGBA samples. A disconnected offsets input is four zero offsets.
- All projected offsets must be ordinary compile-time constants. Constant expression chains are supported and emitted with the required const qualification. Uniforms and specialization constants do not satisfy these operands.
- Projection divides spatial coordinates by the last uv component, which must be nonzero. uv is vec2 for 1D and vec4 for 2D/3D. New projected nodes default uv components to 1 so the divisor is initially valid. Explicit gradients describe coordinates after projection.
- Offset limits depend on the GPU. Native compile validation remains authoritative and failed application retains the previous working Shader.
- Function signatures support TOP Pixel and MAT Vertex/Pixel. Resource access is a separate constraint: current custom Sampler sources remain Pixel-only. Vertex signature compilation is not proof of a usable custom Vertex Sampler binding.
- 1D/3D/Array entries accept compatible existing sampler inputs; this change does not expand Sources bindings, add shadow/integer/multisample resources, or add Cube offset variants.

The semantic reference is [GLSL 4.60, Texture Functions](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html). Per-function reference links are provided in Help.

## Verification

- Core tests: five 2D functions in TOP/MAT graphs, fixed array length and element types, connected constant arrays and component arithmetic, dynamic single Gather offset, rejection of runtime or specialization-constant operands, missing resources, and graph immutability.
- TD 2025.32820: all 13 signatures compile in TOP Pixel, MAT Pixel and MAT Vertex (39 checks).
- Actual 2D resources: five functions × TOP/MAT Pixel × two nonzero offset/component cases match independent direct GLSL expressions (20 pixel comparisons, maximum absolute error 0). Four additional native checks cover constant array/component chains and dynamic offset; two check invalid component application preserves the prior saved state, graph, manifest and pixel Shader source.
- Non-2D resource sampling is signature-tested, not rendered here. Pixel comparisons use the test fixture's sampler state and do not establish every filtering/mipmap configuration.
- Isolated Chromium: all 13 entries can be searched/created; fixed ivec2[4] connection and Undo work; ivec2[3] is rejected; all five Help languages resolve (three groups). This does not claim mobile Safari coverage.

Reproducible tests: tests/unit/test_texture_offsets.py, tests/td/test_texture_offsets.py, tests/td/test_legacy_function_signatures.py, tests/browser/test_texture_offsets.cjs. Private reports: reports/texture-offsets-224/. Existing unit-suite baseline failures are listed in [Testing](../development/TESTING.md).
