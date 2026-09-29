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

As of 0.8.242, Color Output exposes independent **Dither**, **Alpha Test** and **Output Color Space Conversion** switches. New MAT nodes enable all three. These presets retain their equivalent saved `nativeFinishing: true` behavior and show all three checked; editing a switch converts its saved representation in one Undo transaction. Enabled operations run dither → alpha test → output color-space conversion → swizzle. Using an independent conversion node as well applies conversion twice; repeated processing remains the author's choice. Empty unconnected output remains zero; additional color buffers only use Swizzle. See [output finishing behavior](FRAGMENT_EFFECTS.md).

## Evidence and limits

On TD **2025.32820**, `tests/td/test_basic_material_presets.py` compares actual preset rendering with native Phong/PBR MAT under identical scenes: default/custom values, no lights, back faces, SOP sphere, POP geometry, and a PBR environment-light case. Across 13 cases, maximum absolute RGBA error is **0.000003338**. Comparisons use RGBA32F, finite-value checks and interior pixels; fixture dithering is disabled. This is not proof of all-scene equivalence, texture-map behavior or Window / MAT viewer color-space parity.

`tests/td/test_material_preset_placement.py` uses actual TDFam registration and placement, checking MAT/TOP groups, independent copies, master identity behavior, native MAT outlets, compilation, Color controls and preservation of existing user shaders. Browser tests load both stages, render Groups, toggle/undo finishing and compile the edited graph. Color-control tests cover MAT/TOP, component counts 1–4, both control-creation paths, bidirectional edits, unused/explicit Alpha and unchanged Vector styling. Existing custom-parameter regression checks preservation across Apply, rollback, rename and source deletion.

Texture-map combinations, normal/height/displacement mapping, rim/darkness/emission branches, non-2D bindings, and complete auxiliary-output parity still require further graph composition and verification for the original basic graphs. Depth, blending, culling and bone deformation settings remain on the native parameter pages. The basic presets retain guarded picking initialization; custom deformation payload parity remains limited. macOS has not been verified.

## Integrated textured variants (0.8.249)

Two additional **Grape → MAT** entries use the existing **PBR Material** and
**Phong Material** nodes as their Pixel-stage lighting core:

- **PBR Material Textured** (`masters/grape_pbr_textured`): Base Color, Specular
  Level, Metallic, Roughness, Ambient Occlusion, Emission, Alpha, Shadow Strength,
  Shadow Color and Normal maps (10 independent 2D sources).
- **Phong Material Textured** (`masters/grape_phong_textured`): Diffuse, Specular
  Color, Shininess, Ambient, Emission, Alpha, Shadow Strength, Shadow Color and
  Normal maps (9 independent 2D sources).

The two existing basic templates and already placed user components are preserved.
Each new entry is an independent editable graph with source, sampling, channel
selection and multiplication nodes grouped by map purpose. Select the corresponding
Sampler in Sources, or its exposed TD TOP-path control, to assign a texture. Color
maps use RGB; scalar maps use red, including Alpha. The Swizzle nodes can be edited
for other channels or packed textures. All samples use the transported `Tex` UV layer
0 with current-instance UV adjustment. Normal and other data maps must contain the
intended numeric values; these graphs do not apply an automatic sRGB decode.

Each sampled material value is multiplied by its exposed material parameter.
White maps are the neutral defaults. Metallic initially equals 0; Emission and
Shadow Color initially equal black. Increase those material values when using their
maps, as multiplying by zero still produces zero. The normal sampler defaults to
the new portable **Flat normal** source (`builtin:normal`, exactly RGB 0.5, 0.5, 1
in a float TOP). Normal Strength scales the decoded X/Y components and defaults to 1.

Since 0.8.250, built-in images are shared **within each MAT component**. The PBR
template has one white TOP, one flat-normal TOP and ten map Select TOPs (12 TOPs,
previously 30); Phong has the same two images and nine Selects (11, previously 27).
Each map retains one stable Select endpoint for its independent exposed TOP path,
expression and default resolver. The previous extra per-map default Select and
duplicate image are removed after a successful deployment. This keeps the existing
GLSL sampler binding architecture; it is not a requirement that GLSL use Selects.
Copies retain their own images and work without a reference to the master/manager.
No map sampling or shader specialization changes are involved.

Native MAT master networks are arranged as shared images → map Selects → shader /
output, with code above and control/graph data below. New copies inherit this layout.
The explicit `tools/dev/jobs/arrange_material_texture_networks.py` job only moves
master OP coordinates; ordinary Apply does not rearrange existing authored nodes.

PBR Specular Level is multiplied by 0.08 and converted to RGB before entering the
material node. Roughness is bounded below by 0.0001 after map multiplication.
The integrated material already performs the metallic diffuse/specular split; the
graph does not repeat it. Point/instance color, opacity and fog are wired explicitly,
and all three Color Output finishing switches start enabled.

**Normal mapping follows TD's native geometry contract.** The geometry must supply
UVs, normals and `T` (vec4 tangents), for example using Attribute Create SOP.
Vertex-stage `T.xyz` is deformed with `TDDeformNorm`, normalized and combined with
the world normal and `T.w` handedness using `TDCreateTBNMatrix`. The matrix is passed
to Pixel to transform the decoded normal map. There is no derivative reconstruction
or missing-tangent fallback, and no change to the preview geometry. Missing geometry
attributes remain the author's responsibility.

These templates deliberately retain the existing integrated-node behavior, including
PBR's global ambient contribution and Phong's single specular lobe / scalar ambient
control. They are not full native-MAT parity replacements for the original two graphs.
Height, displacement, parallax, rim, secondary Phong specular and separate environment
map workflows are outside this increment. Scene PBR environment lights continue to
be traversed by PBR Material.

`tools/build/build_textured_material_presets.py` explicitly regenerates only the two
new JSON entries. It is not run by startup, Apply or source refresh. Manually edited
masters must still be preserved/exported using the workflow above.

Verification: portable graph compilation/round-trip and sampler regressions;
browser stage loading, finishing Undo, recompile and non-overlapping layout checks;
TD 2025.32820 render comparisons against independently written GLSL using the same
native bindings and vertex data, with a UV/tangent-equipped fixture. Native placement
checks cover independent copies, TOP-path bindings and preservation of existing graphs.
The render comparisons verify this composition, not complete native PBR/Phong parity.
