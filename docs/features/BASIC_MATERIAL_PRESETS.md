# Basic Phong / PBR material graphs

Version 0.8.175 provides editable **Phong MAT Graph** and **PBR MAT Graph** templates. They reproduce the tested basic shading paths; they do not yet reproduce every native material option. The remaining scope is tracked in [MAT native parity](MAT_NATIVE_PARITY.md).

## Add and edit

1. Open the TD **OP Create Dialog** and select the **Grape** family installed by TDFam.
2. Under **MAT**, choose **Phong MAT Graph** or **PBR MAT Graph**. Grape MAT is also in MAT; Grape TOP is in TOP.
3. Select the new component and press **Open Editor** on its custom parameter page. Assign its MAT output to the geometry being rendered.

Each placement is an independent editable graph. Changing one does not alter the template or other placed copies. Existing copies are not automatically replaced when a template changes. Reopen the OP Create Dialog after a family refresh; reload the web editor to load the current UI, after saving any draft.

To improve the template used by **future placements**, open the component under the development manager's `masters`: `grape_phong` or `grape_pbr`, then press **Open Editor**. In the current development TOE the paths are `/TD_Grape/masters/grape_phong` and `/TD_Grape/masters/grape_pbr`. These are the registered masters; the third-party `tdfam` component is not the graph authoring location.

Save the graph and the TD project after arranging it. The corresponding graph in `src/library/material_presets.json` must then be updated from the edited master before committing a new template release. Ordinary source refresh and `prepare_masters()` preserve existing master graphs; the JSON initializes a missing master. Do not overwrite a manually edited master by regenerating the original preset. Previously placed components remain separate.

## Graph organization

Vertex groups cover position, normal, point color and texture coordinates. Pixel groups cover camera view, surface normal, material color, ambient or metallic-surface calculations, roughness, shadows, opacity and output as applicable. Each node belongs to at most one Group. General combining nodes may remain outside Groups. Groups only organize the view; they do not introduce functions or change GLSL.

Both graphs explicitly supply world position, normal, camera index, point/instance color and named `Tex` coordinates across the Vertex / Pixel boundary. No texture map is assigned by default. `Texture Attribute` → `TDInstanceTexCoord (Current)` supplies the UV payload, ready for subsequent map wiring.

Phong includes independent diffuse, ambient, two specular colors and two shininess controls. PBR includes base color, metallic, roughness, specular level, AO, direct lights and environment lights. Both traverse scene lights, handle back-facing normals and include alpha, shadow controls, point/instance color and fog. The camera-view vector is computed from the selected camera's inverse matrix and world position.

Color declarations use native **Color** sources, with RGB custom controls created as **RGBA, Size 3**. Ordinary vectors remain vectors. New Color controls support one through four components in both the expose and create-control workflows. A fresh Color source with fewer than four components uses unused Alpha = 1; an explicitly supplied Alpha, including 0, is retained. Existing controls and bindings are not restyled automatically.

Pixel Output has an opt-in **Native MAT finishing** setting: dither → alpha test → output color-space conversion → swizzle. It is enabled in these presets. Existing graphs retain their previous output behavior. Do not additionally connect a color-space conversion before this setting, which would convert twice. Empty unconnected output remains zero; additional color buffers keep their existing handling.

## Evidence and limits

On TD **2025.32820**, `tests/td/test_basic_material_presets.py` compares actual preset rendering with native Phong/PBR MAT under identical scenes: default/custom values, no lights, back faces, SOP sphere, POP geometry, and a PBR environment-light case. Across 13 cases, maximum absolute RGBA error is **0.000003338**. Comparisons use RGBA32F, finite-value checks and interior pixels; fixture dithering is disabled. This is not proof of all-scene equivalence, texture-map behavior or Window / MAT viewer color-space parity.

`tests/td/test_material_preset_placement.py` uses actual TDFam registration and placement, checking MAT/TOP groups, independent copies, master identity behavior, native MAT outlets, compilation, Color controls and preservation of existing user shaders. Browser tests load both stages, render Groups, toggle/undo finishing and compile the edited graph. Color-control tests cover MAT/TOP, component counts 1–4, both control-creation paths, bidirectional edits, unused/explicit Alpha and unchanged Vector styling. Existing custom-parameter regression checks preservation across Apply, rollback, rename and source deletion.

Texture-map combinations, normal/height/displacement mapping, rim/darkness/emission branches, non-2D bindings, and complete auxiliary-output parity still require further graph composition and verification. Depth, blending, culling and bone deformation settings remain on the native parameter pages. Picking remains excluded pending author decision. macOS has not been verified.
