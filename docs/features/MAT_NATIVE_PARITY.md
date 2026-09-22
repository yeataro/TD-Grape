# Native MAT parity: completion contract

The archival TD-Grape extension must reproduce the capabilities of native Phong MAT and PBR MAT as editable graphs. The author clarified that “basic capability” means the native materials' complete capabilities, not only their lighting equations. The TDFam entries will be **Phong MAT Graph** and **PBR MAT Graph**. They are not complete yet.

The reference is TouchDesigner 2025.32820. Native parameter inspection finds 240 Phong and 202 PBR parameter components, including repeated color components, common settings and UI actions; these are not counts of independent features. Fifteen isolated exports with real geometry, a camera and a light cover lighting, surface options, normal mapping, height mapping, parallax occlusion, displacement, texture maps and Phong multi-texturing. Successful export is reference evidence, not proof that Grape implements those features.

References: [Phong MAT](https://derivative.ca/UserGuide/Phong_MAT), [PBR MAT](https://derivative.ca/UserGuide/PBR_MAT), and the installed host's `outputShader()` results.

## Capability ledger

| Area | Required behavior | Current evidence / remaining work |
|---|---|---|
| Phong lighting | Every scene light, diffuse, primary and secondary specular, independent shininess | Existing material traverses regular lights; secondary specular and independent ambient color still need composition |
| PBR lighting | Direct and environment lights, base color, specular level, metallic, roughness, AO, environment quality | Existing material traverses both light lists; exact native composition still pending |
| Material composition | Emission, constant contribution, ambient uses diffuse, point/instance color, front/back lighting | Available primitives do not yet constitute an equivalent preset |
| Texture maps | Color/base color, diffuse, specular/specular level, metallic, roughness, AO, emission, alpha, darkness, rim | 2D bindings and sampling exist; independent map slots and complete presets pending |
| Sampling settings | Extend U/V/W, nearest/linear/mipmap, anisotropy, chosen channel | Native binding settings need a deliberate exposed interface and preservation across Apply |
| Coordinates | SOP UV layers, POP coordinate attributes, perspective/linear interpolation, screen-space and triplanar modes | Stage interfaces and attributes exist; mode equivalence requires further work |
| Normal mapping | Tangent attribute, deformed TBN, bump scale, back-face orientation | TDCreateTBNMatrix and deformation functions exist; complete connected graph and geometry checks pending |
| Height mapping | Parallax, parallax occlusion, height channel, scale, vertex displacement and midpoint | Native exports inspected; graph implementation and numeric comparison pending |
| Phong environment map | Reflection, rotation, supported map dimensions/projections | Sampling signatures alone do not supply every native resource-binding mode |
| Phong multi-texturing | Four sources with independent coordinates/settings and combination expression | Native export inspected; complete preset pending |
| Alpha | Uniform or angle-dependent alpha, front/side/rolloff, alpha map, light luminance, premultiplication | Native ordering differs between Phong and PBR; preserve each ordering |
| Rim | Multiple rim contributions, color/map, center/width/strength and ramp | Native formula inspected; repeatable graph composition pending |
| Darkness emission | Color/map and lightness-dependent blend, correct placement after fog | Native export inspected; composition pending |
| Outputs | Full shading and native auxiliary values, multiple color buffers, camera-depth alpha | Multiple graph buffers exist; output selection mapping and parity pending |
| Finishing | Fog, dithering, alpha test, output color-space conversion and swizzle | Existing output does not perform native window color-space conversion; explicit preset path required |
| Deformation | Bone/capture data, instance transform, vertex displacement, matching normals and world position | TD deformation calls exist; parameter responsibility awaits author confirmation |
| Common | Blend factors/operations, alpha behavior, depth, culling, wireframe, polygon offset, parameter color space | Proposed native component parameter responsibility awaits confirmation; not silently omitted |
| Host utilities | Substance map assignment, Output Shader action | Need distinguish authoring shortcuts from rendered behavior and provide the applicable entry points |
| Picking | Native exports include TD_PICKING_ACTIVE / TDWritePickingValues | Earlier author ruling excludes new Picking execution flow; full-parity wording must not silently revoke that ruling |
| Delivery | TDFam presets, native MAT outlet, preserved user connections, editable graph, reproducible scene | Outlet fix tested; two final presets and scene not delivered yet |

## Differences already established

- Existing `material_phong` uses one shininess for both native lobes and discards the second result. Native Phong supports a separately weighted second lobe. Independent ambient color also cannot be represented by its scalar ambient multiplier alone.
- Existing `material_pbr` adds `uTDGeneral.ambientColor * diffuse * AO`. The inspected native PBR shader adds direct/environment results without that extra term. Native specular level is multiplied by 0.08, roughness is bounded below by 0.0001, and alpha/point color/map processing precedes light evaluation.
- Native Phong premultiplies the combined lighting by alpha and then applies point color; native PBR incorporates those into base color before lighting. One shared final color multiplier cannot reproduce both.
- Native node viewers convert output to the window color space. A successful Render TOP compilation does not prove viewer parity.

These differences require explicit new composition. Existing graph behavior must not change merely to make the new presets resemble the native materials.

## Acceptance

Each implemented row needs an editable graph path, relevant source/binding controls, Help, and a comparison against native output under the same scene and parameters. Test zero/one/multiple regular lights, environment lighting, textures, normals, transparency, displacement and non-default options. Compilation coverage alone is insufficient. Preserve the author's current graph and scene; use separate validation scenes. Keep unsupported or unverified items visible and do not label the complete presets finished while required rows remain open.
