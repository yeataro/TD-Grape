# Native MAT parity: completion contract

The archival TD-Grape extension must reproduce the capabilities of native Phong MAT and PBR MAT as editable graphs. The author clarified that “basic capability” means the native materials' complete capabilities, not only their lighting equations. Version 0.8.175 provides initial **Phong MAT Graph** and **PBR MAT Graph** TDFam entries; full native parity remains incomplete. See [basic presets](BASIC_MATERIAL_PRESETS.md) for the delivered subset, Group organization, editing instructions and tests.

2026-09-23 clarification: visual/result equivalence is the overall acceptance criterion. The concrete incremental acceptance units are the functions, data access and operations actually used by native exported GLSL. TD conditionally generates code from material parameters, so a default export is insufficient. Audit enabled features and mutually exclusive alternatives. Reproducing TD's parameter-driven specialization machinery or identical source text is not required. Common and Deform parameter pages remain outside this graph-completion scope; existing graph calls must still honor their native settings.

The expanded [native-function inventory](MAT_NATIVE_FUNCTIONS.md) records 158 exported configurations, calls, corresponding graph capabilities and remaining gaps. The earlier fifteen-export probe silently skipped unknown parameter names (including `specularmap`, where Phong uses `specmap`); it is preliminary evidence only. The new audit validates parameter names and menu values and records the material compiler diagnostics, not just Render TOP errors.

The reference is TouchDesigner 2025.32820. Native parameter inspection finds 240 Phong and 202 PBR parameter components, including repeated color components, common settings and UI actions; these are not counts of independent features. Fifteen isolated exports with real geometry, a camera and a light cover lighting, surface options, normal mapping, height mapping, parallax occlusion, displacement, texture maps and Phong multi-texturing. Successful export is reference evidence, not proof that Grape implements those features.

References: [Phong MAT](https://derivative.ca/UserGuide/Phong_MAT), [PBR MAT](https://derivative.ca/UserGuide/PBR_MAT), and the installed host's `outputShader()` results.

0.8.174 adds explicit projection-map LOD sampling and size lookup through native Light COMP bindings. Six native-call comparisons pass; this is a resource-access increment, not completion of the material presets.

## Capability ledger

| Area | Required behavior | Current evidence / remaining work |
|---|---|---|
| Phong lighting | Every scene light, diffuse, primary and secondary specular, independent shininess | Basic editable composition delivered in 0.8.175; earlier 9 contribution checks plus new whole-material comparisons pass; advanced branches pending |
| PBR lighting | Direct and environment lights, base color, specular level, metallic, roughness, AO, environment quality | Basic editable composition delivered in 0.8.175; earlier 10 contribution checks plus new whole-material comparisons pass; advanced branches pending |
| Material composition | Emission, constant contribution, ambient uses diffuse, point/instance color, front/back lighting | Available primitives do not yet constitute an equivalent preset |
| Texture maps | Color/base color, diffuse, specular/specular level, metallic, roughness, AO, emission, alpha, darkness, rim | 2D bindings and sampling exist; independent map slots and complete presets pending |
| Sampling settings | Extend U/V/W, nearest/linear/mipmap, anisotropy, chosen channel | Native binding settings need a deliberate exposed interface and preservation across Apply |
| Coordinates | SOP UV layers, POP coordinate attributes, perspective/linear interpolation, screen-space and triplanar modes | Texture Attribute provides the named SOP/POP accessor; Current Instance UV and stage transport pass 7 native comparisons. Complete preset wiring and other coordinate modes remain pending |
| Normal mapping | Tangent attribute, deformed TBN, bump scale, back-face orientation | TDCreateTBNMatrix and deformation functions exist; complete connected graph and geometry checks pending |
| Height mapping | Parallax, parallax occlusion, height channel, scale, vertex displacement and midpoint | Native exports inspected; graph implementation and numeric comparison pending |
| Phong environment map | Reflection, rotation, supported map dimensions/projections | Sampling signatures alone do not supply every native resource-binding mode |
| Phong multi-texturing | Four sources with independent coordinates/settings and combination expression | Native export inspected; complete preset pending |
| Alpha | Uniform or angle-dependent alpha, front/side/rolloff, alpha map, light luminance, premultiplication | Native ordering differs between Phong and PBR; preserve each ordering |
| Rim | Multiple rim contributions, color/map, center/width/strength and ramp | Native formula inspected; repeatable graph composition pending |
| Darkness emission | Color/map and lightness-dependent blend, correct placement after fog | Native export inspected; composition pending |
| Outputs | Full shading and native auxiliary values, multiple color buffers, camera-depth alpha | Multiple graph buffers exist; output selection mapping and parity pending |
| Finishing | Fog, dithering, alpha test, output color-space conversion and swizzle | 0.8.175 presets wire fog and enable opt-in native finishing order on Pixel Output; old graphs retain their existing order. Window/viewer comparison remains pending |
| Deformation | Bone/capture data, instance transform, vertex displacement, matching normals and world position | Author confirmed bone deformation settings remain on native parameter pages; graph deformation calls must still use those settings correctly |
| Common | Blend factors/operations, alpha behavior, depth, culling, wireframe, polygon offset, parameter color space | Author confirmed depth, blending and culling remain on native parameter pages; preserve these settings across Apply |
| Host utilities | Substance map assignment, Output Shader action | Authoring shortcuts are not extra GLSL capabilities. The required target is their resulting material behavior, not a clone of the native authoring interface |
| Picking | Native exports include TD_PICKING_ACTIVE / TDWritePickingValues | Basic guarded vertex initialization delivered in 0.8.216 and compared with native picking in an isolated scene. Custom deformation payload mismatch remains an accepted known limitation; a dedicated Picking pipeline is a future design direction. See the Picking note below |
| Delivery | TDFam presets, native MAT outlet, preserved user connections, editable graph, reproducible scene | Two initial presets delivered in 0.8.175 under MAT, grouped by calculation purpose; actual placement/outlet checks pass. Reproducible native-comparison fixture is in tests; full presets and a user-facing example scene remain pending |

Sampler binding findings: custom declarations currently accept only `sampler2D`; Cube/3D call signatures do not imply binding support. TD reports an incompatible bound TOP as a warning while still linking, and the render is black. In 0.8.169, Apply treats that specific warning as a resource-type failure and preserves the last working shader (`tests/td/test_mat_sampler_mismatch.py`). Other native warnings remain non-fatal. Live changes outside Apply and additional sampler dimensions still need coverage; this fix alone does not complete texture support.

## Differences already established

- Existing `material_phong` uses one shininess for both native lobes and discards the second result. Native Phong supports a separately weighted second lobe. Independent ambient color also cannot be represented by its scalar ambient multiplier alone.
- Existing `material_pbr` adds `uTDGeneral.ambientColor * diffuse * AO`. The inspected native PBR shader adds direct/environment results without that extra term. Native specular level is multiplied by 0.08, roughness is bounded below by 0.0001, and alpha/point color/map processing precedes light evaluation.
- Native Phong premultiplies the combined lighting by alpha and then applies point color; native PBR incorporates those into base color before lighting. One shared final color multiplier cannot reproduce both.
- Native node viewers convert output to the window color space. A successful Render TOP compilation does not prove viewer parity.

These differences require explicit new composition. Existing graph behavior must not change merely to make the new presets resemble the native materials.

## Acceptance

Each implemented row needs an editable graph path, relevant source/binding controls, Help, and a comparison against native output under the same scene and parameters. Test zero/one/multiple regular lights, environment lighting, textures, normals, transparency, displacement and non-default options. Compilation coverage alone is insufficient. Preserve the author's current graph and scene; use separate validation scenes. Keep unsupported or unverified items visible and do not label the complete presets finished while required rows remain open.

For each small capability, first verify the correct native signature, stage, inputs, resources and usable graph output. Then compose the complete materials and use rendered comparisons for integration acceptance. A function name present in the catalog does not prove that its required bindings or stage transport work. Export coverage is not Grape feature completion.

## 0.8.168 lighting evidence

`tests/td/test_native_light_sums.py` compares the rendered interior against native MATs for zero/one/two regular lights. Phong diffuse, primary specular and secondary specular match exactly in these cases. PBR direct-light maximum absolute RGB difference is 0.0000282. `tests/td/test_native_environment_light_sums.py` uses a real environment map with one/two environment lights; maximum difference is 0.0000681. Both use floating-point render targets, disable fixture dithering, and check finite results, an unlit black baseline and nonzero lit references. The initial zero-light baseline check exposed TD's default dithering (about ±0.00195), not an extra lighting contribution. Both suites passed again after disabling that fixture setting. These are contribution tests, not complete material or all-scene equivalence.

`Phong Lights`, `PBR Lights`, and `PBR Environment Lights` require explicit normalized world-space normal/view inputs. They add no material colors, ambient term, emission or alpha. The original integrated material nodes retain their prior behavior. `tests/unit/native_light_sum_fixture.py` demonstrates the connected geometry/camera path using ordinary nodes and the shared Vertex interface.

## Picking: known limitation and future pipeline (2026-09-23)

After the initial manual-test discussion, the author explicitly authorized basic Picking support as a separate deliverable after Sampler custom controls. Version 0.8.216 emits `TDWritePickingValues()` guarded by `TD_PICKING_ACTIVE` at the end of the MAT vertex `main()`, before its closing brace. Pixel and TOP code are unchanged. This is default payload initialization, not a dedicated graph pipeline or custom payload editor.

`tests/td/test_basic_picking.py` verifies color, texture, Phong and PBR graphs against native Phong picking on TD 2025.32820: hit/miss, position and normal in SOP/world/camera space, UV, color and non-instanced instance ID; both untransformed and translated/rotated geometry are covered. Ordinary rendering with and without the guarded call is pixel-identical. Custom vertex deformation, instancing, custom attributes and multi-camera combinations are not covered by this test.

Target shell version advances from 2 to 3; saved Shaders require the existing explicit upgrade review. Four product Masters are upgraded while retaining node graphs and native identities. User Shader graphs are not automatically recompiled. `tests/unit/test_picking_shell.py` checks the upgrade boundary and existing node source-map locations.

**Known limitation:** default picking payload may not match positions or normals modified by a custom vertex graph. Selecting an object and receiving correct position/normal data are separate acceptance checks. The author accepts recording this limitation rather than solving custom payload handling now. If needed later, matching `vTDPickVert` fields must be written after default initialization. See [TD Picking documentation](https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Picking).

**Future design direction:** provide a dedicated Picking pipeline if graph authors need control over picking data. Define initialization, custom payload writes and their execution order separately from ordinary shading. Which operations are permitted in this pipeline remains undecided; this does not imply a new GLSL hardware stage or approval to add unrestricted side-effect nodes. This direction is distinct from the small default-initialization candidate above and is not current implementation scope.

The author further requires the Picking inputs and outputs to correspond correctly. Future design must specify where each input comes from, its type and coordinate space, and the matching picking output field. In particular, position/normal payload must agree with the actual vertex deformation used for rendering. A dedicated pipeline alone does not establish this correspondence; its interface remains to be designed.
